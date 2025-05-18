// 현재 설치한 것들 : express, cors, multer, canvas jsdom
const express = require('express'); // CommonJS의 경우
// 위의 구문의 경우 두 줄 다 쓰는 것이 아니라 자신이 쓰는 형식에 맞춰서 써야한다
const cors = require('cors'); // CORS 문제 해결
const app = express();

// CORS 문제 해결
app.use(cors()); // 모든 origin 허용

//body parser
app.use(express.json({limit: '50mb'})) // express로 받아온 json 데이터를 parsing
app.use(express.urlencoded({extended:true, limit: '50mb'})) // url 정보를 parsing 

const port = 3000;

// 반환할 때 쓰일 Json 데이터
const res_Json = {
    err : null
};


app.get('/', (req, res) => {
  res.send('Hello World!');
})

app.get('/api/todo', (req, res) => {
    res.json(todolist)
});


const { spawn } = require('child_process');
const python = spawn('python', ['analyze.py'], {
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' }  // 아예 이렇게 고정적으로 명시해야 한국어 안깨짐
}
);
//python.stdin.setDefaultEncoding('utf-8');
app.post('/api/emotion', async (req, res) => {
    const { text } = req.body;  // body 태그에 있는 json 중 "text만 추출"
    try{
        const result = await analyzeText(text);
        res.json(Object.assign({}, result, res_Json)); // 감정을 점수로 반환 {점수 : 0, err:null}
    }
    catch (err) {
        console.error('❌ 오류 발생:', err);
        res_Json.err = err.message
        res.status(500).json(res_Json);
    }
})

function analyzeText(text) {
  return new Promise((resolve, reject) => {
    python.stdin.write(JSON.stringify({ text }) + '\n');

    python.stdout.once('data', (data) => {
      try {
        const result = JSON.parse(data.toString('utf-8'));
        resolve(result);
      } catch (err) {
        reject(err);
      }
    });

    python.stderr.once('data', (err) => {
      reject(err.toString('utf-8'));
    });
  });
}

/* -------- 여기 아래부턴 OCR----------- */
 


// OCR을 위한 공통 모듈 준비
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const fs = require('fs');
const { createCanvas, Image, ImageData } = require('canvas');
const { JSDOM } = require('jsdom');
const path = require('path');

// 가짜 DOM 설정
const dom = new JSDOM();
global.window = dom.window;
global.document = dom.window.document;
global.HTMLCanvasElement = createCanvas().constructor;
global.HTMLImageElement = Image;

// OpenCV.js 로드
let cvReadyResolve;
const cvReady = new Promise(resolve => {
  cvReadyResolve = resolve;
});
global.Module = {
  onRuntimeInitialized() {
    console.log('✅ OpenCV.js loaded');
    global.cv = global.Module;
    cvReadyResolve(); // Promise resolve 호출
  }
};

const opencvJs = fs.readFileSync('./opencv.js', 'utf8');
eval(opencvJs); // 전역에 cv 등록됨

// OCR 인식 부분분
const Tesseract = require('tesseract.js');

// OCR 데이터 post로 받고 반환
// express 만으로는 이미지를 받지 못하기에 base64로 변환환
app.post('/api/ocr', async (req, res) => {
    try{
    await cvReady;
    console.log('✅ /api/ocr 진입');
    console.log('받은 데이터 길이:', req.body?.data?.length)

    const base64Data = req.body.data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
 
    const image = new Image();
    image.src = buffer;

    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    const imageData = ctx.getImageData(0, 0, image.width, image.height);

    const src = cv.matFromImageData(imageData);
    let dst = new cv.Mat();
    let gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // 예시: src = 원본 이미지(Mat), dst = 리사이징 결과(Mat)
    const desiredWidth = 800;
    const aspectRatio = src.rows / src.cols; // height / width
    const newHeight = Math.round(desiredWidth * aspectRatio);

    // 새로운 크기 지정
    const dsize = new cv.Size(desiredWidth, newHeight);
    cv.resize(gray, gray, dsize, 0, 0, cv.INTER_AREA);
    cv.imshow(canvas, gray);
    fs.writeFileSync('./gray.png', canvas.toBuffer('image/png'));
    /*
        1. 가우시안으로 이진화 (선이 얇아짐)
        2. erode()로 확장 (노이즈가 생김)  << --- 이 부분은 오히려 영수증에선 좋지 않은 것으로 판결결
        3. gaussian blur 적용 (혼자 있는 노이즈는 흐려짐(회색이 됨))

        4. otsu로 이진화 (픽셀 값의 히스토그램 기반, 회색이 된 노이즈들을 완전히 흰색으로 변경)
        5. 이진화된 이미지를 gray이미지에 and 연산 (검정색으로 된 부분만 추출 가능 -> blur 적용으로 삐죽거리는 선들을 정리 가능)
    */


    // 1차 이진화화
    let blockSize = 11;  // 항상 홀수, 11~21 범위 추천
    let C = 5;           // 글씨가 얇으면 C를 낮게, 배경이 복잡하면 C를 높게
    let adap = new cv.Mat();
    cv.adaptiveThreshold(gray, adap, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, blockSize, C);
    dst = adap;

    cv.imshow(canvas, dst);
    fs.writeFileSync('./adaptive.png', canvas.toBuffer('image/png'));
    
    // 노이즈 흐리게게
    cv.GaussianBlur(dst, dst, new cv.Size(5,5), 0);
    cv.imshow(canvas, dst);
    fs.writeFileSync('./blur.png', canvas.toBuffer('image/png'));

    // 2차 이진화 -> 흐려진 노이즈 일부 제거
    cv.threshold(dst, dst, 0, 255, cv.THRESH_BINARY+ cv.THRESH_OTSU);
    cv.imshow(canvas, dst);
    fs.writeFileSync('./ostu.png', canvas.toBuffer('image/png'));


    // 마스크 생성 & 반전 시킴
    // let mask = new cv.Mat();
    // cv.bitwise_not(dst, mask)
    // cv.imshow(canvas, mask);
    // fs.writeFileSync('./bitnot.png', canvas.toBuffer('image/png'));

    // // bitwise_and 연산에 생성한 마스크 적용 후 
    // cv.bitwise_and(dst, adap, dst, mask)
    // cv.imshow(canvas, dst);
    // fs.writeFileSync('./bitand.png', canvas.toBuffer('image/png'));
    
    //cv.GaussianBlur(dst, dst, new cv.Size(3,3), 0);
    //cv.adaptiveThreshold(dst, dst, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, blockSize, C);

    //cv.threshold(dst, dst, 0, 255, cv.THRESH_BINARY+ cv.THRESH_OTSU);// 영역 전체에 threshold를 거므로 오히려 안좋음
    
    cv.imshow(canvas, dst);
    dst.delete();
    
    const ocrCanvasBuffer = canvas.toBuffer('image/png');
    fs.writeFileSync('./result.png', ocrCanvasBuffer);
    const {data : {text}} = await Tesseract.recognize(
      ocrCanvasBuffer,
      'kor', // 한글 언어
      {
        langPath: 'https://tessdata.projectnaptha.com/4.0.0/',//path.join(__dirname, 'tessdata'), // kor.traineddata 파일 위치 폴더
        //logger: m => console.log('[OCR 진행 로그]', m)
      }
    );
    console.log(text);
    let re = analyzeReceipt(text);
    console.log(re);
    res.json(Object.assign({}, re, res_Json));
    }
    catch (err) {
        console.error('❌ 오류 발생:', err);
        res_Json.err = err.message
        res.status(500).json(res_Json);
    }
})

// 후처리
function fixMisreadDate(originalLine) {
  const raw = originalLine.replace(/\s+/g, '');
  //console.log(raw)
  let candidate = raw.replace(/(\d)7(\d)/g, '$1/$2');  // 7 → / 보정만 복사본에서 수행
  //console.log(candidate)
  // ✅ 1순위: '25/05/08' 형태 (정확히 25로 시작하는 날짜)
  const match25 = candidate.match(/25[./]\d{2}[./]\d{2}/);
  if (match25) return match25[0];

  // ✅ 2순위: 앞에 숫자가 붙은 '0025/05/08' 같은 형태 → '25/05/08' 추출
  const embedded25 = candidate.match(/\d*25[./]\d{2}[./]\d{2}/);
  if (embedded25) {
    const refined = embedded25[0].match(/25[./]\d{2}[./]\d{2}/);
    if (refined) return refined[0];
  }

  // ✅ 3순위: 일반 날짜 포맷은 가장 마지막에 시도
  const normal = candidate.match(/\d{2,4}[./]\d{2}[./]\d{2}/);
  if (normal) return normal[0];

  return null;
}
function fixSpacing(text) {
  return normalizeFullWidthToHalfWidth(text).replace(/\s+/g, '');
}

function normalizeNumber(text) {
  return parseInt(text.replace(/[^\d]/g, ''), 10);
}

function analyzeReceipt(text) {
  const lines = text.split(/\r?\n/);
  const result = {
    날짜: null,
    총액: null
    //,물품: []
  };

  // 1. 날짜 우선 후보 탐색 (거래일시 등 키워드가 포함된 줄 우선)
  for (const line of lines) {
    const noSpaceLine = fixSpacing(line);
    const hasDateKeyword = /(거래\s*일시|일시|날짜)/i.test(noSpaceLine);
    console.log(hasDateKeyword, noSpaceLine);
    const fixed = fixMisreadDate(noSpaceLine);
    if (hasDateKeyword && fixed) {
      result.날짜 = fixed;
      break;
    }
  }

  // 2. 날짜가 아직 없다면 기존 방식으로 다시 탐색
  if (!result.날짜) {
    for (const line of lines) {
        const noSpaceLine = fixSpacing(line);
      const fixed = fixMisreadDate(noSpaceLine);  // ✅ 여기도 fixMisreadDate 사용!
      if (fixed) {
        result.날짜 = fixed;
        break;
      }
    }
  }

  // 3. 총액, 물품 추출
  for (const line of lines) {
    const noSpaceLine = fixSpacing(line);

    // 총액 추출 (단어 일부 포함만 돼도 인정)
    const hasTotalKeyword = /(큼랙|금랙|총금랙|금액|금맥|합계|항계|함계|합꼐|함꼐|많게|많계|총액|총금액|총금|계)/.test(noSpaceLine);
    console.log(hasTotalKeyword, noSpaceLine);
    if (!result.총액 && hasTotalKeyword) {
      const numberMatch = noSpaceLine.match(/\d[\d,.\s]*\d/);
      if (numberMatch) {
        result.총액 = normalizeNumber(numberMatch[0]);
        continue;
      }
    }

    // // 물품명 추출
    // const hasPrice = /[0-9]{2,}/.test(noSpaceLine);
    // const hasHangul = /[가-힣]/.test(noSpaceLine);
    // if (hasPrice && hasHangul) {
    //   const word = fixSpacing(line).replace(/[^가-힣A-Za-z]/g, '');
    //   if (word.length > 1 && !result.물품.includes(word)) {
    //     result.물품.push(word);
    //   }
    // }
  }

  return result;
}

//전각 문자 인식 오류 해결결
function normalizeFullWidthToHalfWidth(text) {
  return text.replace(/[\uFF01-\uFF5E]/g, ch => {
    return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
  }).replace(/\u3000/g, ' '); // 전각 스페이스도 일반 스페이스로
}


app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});