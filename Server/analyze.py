import sys
import json

#pip install transformers torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification  
import torch

model_name = "tabularisai/multilingual-sentiment-analysis"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForSequenceClassification.from_pretrained(model_name)

def predict_sentiment(texts):
    inputs = tokenizer(texts, return_tensors="pt", truncation=True, padding=True, max_length=512)
    with torch.no_grad():
        outputs = model(**inputs)
    probabilities = torch.nn.functional.softmax(outputs.logits, dim=-1)
    #sentiment_map = {0: "Very Negative", 1: "Negative", 2: "Neutral", 3: "Positive", 4: "Very Positive"}
    #return [sentiment_map[p] for p in torch.argmax(probabilities, dim=-1).tolist()]
    return torch.argmax(probabilities, dim=-1).tolist()[0] # 점수만 반환하도록 함. 처리는 프론트에서 하게

#result = predict_sentiment("행운") #"오늘 시합에서 져서 조금 슬픈데, 족발을 먹어서 기분이 무진장 나아졌어" -> negative ???
                                    # 무진장이라는 단어에 very negative를 붙임. 아무래도 가중치가 잘못 설정 되어 있는 듯?
#print(result)
for line in sys.stdin:
    try:
        data = json.loads(line) # json 형식의 파일을 json으로 입력 받음(사실 여기선 dictionary처럼 다뤄짐)
        if 'text' not in data:
            raise KeyError('입력에 text 키가 없습니다')
        
        text = data['text']
        result = {}
        result['점수'] = predict_sentiment(text)
        #text = data['text'] + 'xptmxm' 
        print(json.dumps(result, ensure_ascii=False)) # dictionary를 json.dumps()를 통해 json으로 변환함
        #print(data)
        sys.stdout.flush()
    except Exception as e:
        print(json.dumps({ "error": str(e) }), file=sys.stderr)
        sys.stdout.flush()