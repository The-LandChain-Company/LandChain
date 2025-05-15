from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from .config import Config
import json
from web3 import Web3
import logging  # Add this at the top
from pathlib import Path

db = SQLAlchemy()

# Placeholder for Web3 connection
w3 = None
nft_land_contract = None
action_logger_contract = None
nft_marketplace_contract = None


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

    CORS(app, supports_credentials=True)

    # Configure Flask logger if not already done elsewhere
    if not app.debug:  # Example: Log more in production
        app.logger.setLevel(logging.INFO)
    else:
        app.logger.setLevel(logging.DEBUG)

    db.init_app(app)

    global w3, nft_land_contract, action_logger_contract, nft_marketplace_contract

    if not app.config['POLYGON_RPC_URL']:
        raise ValueError("POLYGON_RPC_URL not set in .env or config")

    w3 = Web3(Web3.HTTPProvider(app.config['POLYGON_RPC_URL']))
    if not w3.is_connected():
        raise ConnectionError("Failed to connect to Polygon RPC")

    def load_contract(address_key, abi_path_key):
        contract_address = app.config.get(address_key)
        abi_path = app.config.get(abi_path_key)
        if not contract_address or not abi_path:
            # Allow some contracts to be optional if not immediately needed or for partial setups
            app.logger.warning(f"{address_key} or {abi_path_key} not configured.")
            return None
        try:
            with open(abi_path) as f:
                abi = json.load(f)
            return w3.eth.contract(address=Web3.to_checksum_address(contract_address), abi=abi)
        except FileNotFoundError:
            app.logger.error(f"ABI file not found: {abi_path}")
            return None
        except Exception as e:
            app.logger.error(f"Error loading contract {address_key}: {e}")
            return None

    nft_land_contract = load_contract('NFT_LAND_CONTRACT_ADDRESS',
                                      f"{Path(__file__).parent / "abi" / 'NFT_LAND_CONTRACT_ABI_PATH'}")
    action_logger_contract = load_contract('ACTION_LOGGER_CONTRACT_ADDRESS',
                                           f"{Path(__file__).parent / "abi" / 'ACTION_LOGGER_CONTRACT_ABI_PATH'}")
    nft_marketplace_contract = load_contract('NFT_MARKETPLACE_CONTRACT_ADDRESS',
                                             f"{Path(__file__).parent / "abi" / 'NFT_MARKETPLACE_CONTRACT_ABI_PATH'}")

    # Blueprints
    from .routes import bp as main_bp
    app.register_blueprint(main_bp)

    # Create database tables if they don't exist
    with app.app_context():
        db.create_all()  # Ensure models are imported before this

    return app
