from flask import Blueprint, request, jsonify
import requests
from bs4 import BeautifulSoup
import re
import urllib.parse

bp = Blueprint("web", __name__)

@bp.route("/fetch", methods=["POST"])
def fetch_web():
    data = request.get_json() or {}
    url = data.get("url")
    if not url:
        return jsonify({"detail": "url is required"}), 400
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        # Remove scripts and styles
        for script in soup(["script", "style"]):
            script.extract()
        text = soup.get_text(separator=' ')
        text = re.sub(r'\s+', ' ', text).strip()
        return jsonify({"success": True, "text": text})
    except Exception as e:
        return jsonify({"detail": str(e)}), 500

@bp.route("/search", methods=["POST"])
def search_web():
    data = request.get_json() or {}
    query = data.get("query")
    if not query:
        return jsonify({"detail": "Query is required"}), 400
    try:
        url = f"https://lite.duckduckgo.com/lite/"
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.post(url, data={"q": query}, headers=headers, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        results = []
        
        # Simplified DuckDuckGo Lite parsing
        for tr in soup.find_all('tr'):
            td_result_snippet = tr.find('td', class_='result-snippet')
            if td_result_snippet:
                a_tag = tr.find_previous_sibling('tr').find('a', class_='result-link')
                if a_tag:
                    href = a_tag.get('href')
                    if 'uddg=' in href:
                        qs = urllib.parse.parse_qs(urllib.parse.urlparse(href).query)
                        href = qs.get('uddg', [href])[0]
                    
                    results.append({
                        "url": href,
                        "title": a_tag.get_text(strip=True),
                        "snippet": td_result_snippet.get_text(strip=True)
                    })
                    if len(results) >= 5:
                        break
        
        return jsonify({"success": True, "results": results})
    except Exception as e:
        return jsonify({"detail": str(e)}), 500
