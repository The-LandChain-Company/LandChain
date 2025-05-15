import requests
from werkzeug.datastructures import FileStorage

# Pinata API credentials
PINATA_API_KEY = '92efcee5d06e8fa01f88'
PINATA_SECRET_API_KEY = '8470cb03e5debce68c3abdf91f2f722c3c85713be1046d12e473f73ff6c4b8b8'


def upload_json(data: dict) -> str:
    # Set request headers
    headers = {
        "pinata_api_key": PINATA_API_KEY,
        "pinata_secret_api_key": PINATA_SECRET_API_KEY,
        "Content-Type": "application/json"
    }

    # Set the endpoint
    url = "https://api.pinata.cloud/pinning/pinJSONToIPFS"

    # Send request
    response = requests.post(url, headers=headers, json={"pinataContent": data})

    # Output the IPFS hash
    if response.status_code == 200:
        return response.json()["IpfsHash"]
    else:
        return f"error: {response.status_code}, {response.text}"


def upload_file(file: FileStorage) -> str:
    # API endpoint
    url = 'https://api.pinata.cloud/pinning/pinFileToIPFS'

    # Headers (note: no 'Content-Type' when uploading files!)
    headers = {
        'pinata_api_key': PINATA_API_KEY,
        'pinata_secret_api_key': PINATA_SECRET_API_KEY
    }

    files = {
        'file': (file.filename, file.stream)
    }

    response = requests.post(url, files=files, headers=headers)

    if response.status_code == 200:
        return response.json()['IpfsHash']
    else:
        return f"error: {response.status_code}, {response.text}"
