import csv
import json
import re
import os

def youtube_id_from_url(url):
    pattern = r'(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?(.+)'
    match = re.search(pattern, url)
    return match.group(1) if match else None

def sanitize_filename(filename):
    # 파일 이름에 사용할 수 없는 문자 제거 또는 대체
    return re.sub(r'[\\/*?:"<>|]', "", filename)

def csv_to_json(csv_file_path, json_file_path):
    data = []
    print(f"Opening CSV file: {csv_file_path}")
    try:
        with open(csv_file_path, 'r', encoding='utf-8') as csv_file:
            csv_reader = csv.DictReader(csv_file)
            for row in csv_reader:
                if not any(row.values()):
                    continue
                youtube_id = youtube_id_from_url(row['유튜브주소'])
                if youtube_id:
                    sanitized_title = sanitize_filename(row['제목'])
                    item = {
                        "id": youtube_id,
                        "title": row['제목'],
                        "productionDate": row['작업년도'],
                        "client": row['클라이언트'],
                        "type": row['형식'].split(','),  # 쉼표로 구분된 값을 배열로 변환
                        "image": f"./asset/work/Thumbnails/{row['작업년도']}/{sanitized_title}.webp"
                    }
                    data.append(item)
                    print(f"Processed: {row['제목']}")
                else:
                    print(f"Warning: Could not extract YouTube ID from {row['유튜브주소']}")

        print(f"Writing to JSON file: {json_file_path}")
        with open(json_file_path, 'w', encoding='utf-8') as json_file:
            json.dump(data, json_file, ensure_ascii=False, indent=2)
        print("Conversion completed successfully")
    except Exception as e:
        print(f"An error occurred: {e}")

# 스크립트 실행
csv_to_json('videos.csv', 'videos.json')