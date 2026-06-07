from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx
from bs4 import BeautifulSoup
import re

router = APIRouter()

class FetchRequest(BaseModel):
    url: str

@router.post("/fetch")
async def fetch_web(req: FetchRequest):
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(req.url)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            # Remove scripts and styles
            for script in soup(["script", "style"]):
                script.extract()
            text = soup.get_text(separator=' ')
            text = re.sub(r'\s+', ' ', text).strip()
            return {"success": True, "text": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class SearchRequest(BaseModel):
    query: str

@router.post("/search")
async def search_web(req: SearchRequest):
    if not req.query:
        raise HTTPException(status_code=400, detail="Query is required")
    try:
        url = f"https://lite.duckduckgo.com/lite/?q={req.query}"
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        async with httpx.AsyncClient() as client:
            response = await client.post(url, data={"q": req.query}, headers=headers)
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
                            import urllib.parse
                            qs = urllib.parse.parse_qs(urllib.parse.urlparse(href).query)
                            href = qs.get('uddg', [href])[0]
                        
                        results.append({
                            "url": href,
                            "title": a_tag.get_text(strip=True),
                            "snippet": td_result_snippet.get_text(strip=True)
                        })
                        if len(results) >= 5:
                            break
            
            return {"success": True, "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
