import json
import unittest
from unittest.mock import MagicMock, patch
from urllib.error import URLError

import assistant_backend


def mocked_response(payload):
    response = MagicMock()
    response.__enter__.return_value = response
    response.read.return_value = payload
    return response


class AssistantBackendTests(unittest.TestCase):
    def test_generate_reply_searches_and_uses_local_ollama(self):
        model_list = json.dumps({"models": [{"name": "llama3.2:3b"}]}).encode("utf-8")
        search_html = (
            '<div class="result"><a class="result__a" href="https://example.com/article">'
            'Example &amp; Article</a><a class="result__snippet">Useful search context</a></div>'
            '<div class="result"><a class="result__a" href="http://unsafe.example/">Unsafe</a></div>'
        ).encode("utf-8")
        ollama_reply = json.dumps({
            "message": {"content": "A concise local answer."}
        }).encode("utf-8")
        responses = [
            mocked_response(model_list),
            mocked_response(search_html),
            mocked_response(ollama_reply)
        ]

        with patch("assistant_backend.urllib.request.urlopen", side_effect=responses) as urlopen:
            result = assistant_backend.generate_reply(
                "What is this?",
                [{"role": "model", "text": "Earlier answer"}]
            )

        self.assertEqual(len(urlopen.call_args_list), 3)
        search_request = urlopen.call_args_list[1].args[0]
        self.assertIn("q=What+is+this%3F", search_request.full_url)
        ollama_request = urlopen.call_args_list[2].args[0]
        body = json.loads(ollama_request.data)
        self.assertEqual(body["model"], "llama3.2:3b")
        self.assertEqual(body["messages"][1]["role"], "assistant")
        self.assertEqual(result["reply"], "A concise local answer.")
        self.assertEqual(result["sources"], [{
            "title": "Example & Article",
            "url": "https://example.com/article"
        }])

    def test_status_explains_when_ollama_is_unavailable(self):
        with patch("assistant_backend.urllib.request.urlopen", side_effect=URLError("offline")):
            status = assistant_backend.get_status()

        self.assertFalse(status["configured"])
        self.assertIn("Ollama is not running", status["message"])

    def test_status_explains_when_model_is_not_installed(self):
        response = mocked_response(json.dumps({"models": []}).encode("utf-8"))
        with patch("assistant_backend.urllib.request.urlopen", return_value=response):
            status = assistant_backend.get_status()

        self.assertFalse(status["configured"])
        self.assertIn("ollama pull llama3.2:3b", status["message"])


if __name__ == "__main__":
    unittest.main()
