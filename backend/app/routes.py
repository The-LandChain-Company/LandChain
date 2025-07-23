# app/routes.py
from flask import Blueprint, request, jsonify, current_app, session, render_template
from web3 import Web3  # IMPORT Web3
from itsdangerous import URLSafeTimedSerializer  # IMPORT URLSafeTimedSerializer

# Import from your app modules using relative imports
from . import auth, services, models, db, ipfs  # Assuming db is also in app/__init__
from .models import User, ActionLog, AdminLoginToken  # Explicitly import models used
from functools import wraps
from datetime import datetime, UTC
import asyncio
from werkzeug.datastructures import FileStorage  # For type hinting
import io  # For creating in-memory file for HTML content
from pathlib import Path


# Placeholder for your actual ipfs.py functions
# Ensure these are correctly imported in your actual file
def upload_file_to_ipfs(file_storage_object: FileStorage) -> str:
    from .ipfs import upload_file  # Assuming ipfs.py is in the same directory or PATH
    return upload_file(file_storage_object)


def upload_json_to_ipfs(data: dict) -> str:
    from .ipfs import upload_json  # Assuming ipfs.py is in the same directory or PATH
    return upload_json(data)


bp = Blueprint('main', __name__)

w3 = Web3(Web3.HTTPProvider('https://polygon-amoy.g.alchemy.com/v2/2l_tXPgmiK-xL46C2bzC4C_tw1LnCQtC'))


def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, **kwargs)

    return decorated_function


def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session or not session.get('is_admin'):
            return jsonify({"error": "Admin privileges required"}), 403
        # Optionally, re-verify against DB for extra security
        user = User.query.get(session['user_id'])
        if not user or not user.is_admin:
            return jsonify({"error": "Admin privileges required"}), 403
        return f(*args, **kwargs)

    return decorated_function


# --- Auth Routes ---
@bp.route('/auth/register/email', methods=['POST'])
def register_email():
    return auth.register_user_email()


@bp.route('/auth/login/email', methods=['POST'])
def login_email():
    return auth.login_user_email()


@bp.route('/auth/login/metamask/challenge', methods=['GET'])
def metamask_challenge():
    return auth.metamask_login_challenge()


@bp.route('/auth/login/metamask/verify', methods=['POST'])
def metamask_verify():
    return auth.metamask_login_verify()


@bp.route('/auth/logout', methods=['POST'])
@login_required
def logout():
    return auth.logout_user()


@bp.route('/auth/status', methods=['GET'])
@login_required
def auth_status():
    user_id = session.get('user_id')
    user = User.query.get(user_id)
    if user:
        return jsonify({
            "logged_in": True,
            "user_id": user.id,
            "email": user.email,
            "wallet_address": user.wallet_address,
            "is_admin": user.is_admin
        })
    return jsonify({"logged_in": False}), 401  # Should not happen if @login_required works


# --- Google OAuth Routes (Conceptual) ---
# @bp.route('/auth/login/google')
# def login_google():
#     # Redirect to Google OAuth
#     pass
# @bp.route('/auth/google/callback')
# def google_callback():
#     # Handle callback, exchange code for token, get user info
#     # Client then uses Web3Auth with Google to get wallet, sends to /auth/link/google_wallet
#     pass
# @bp.route('/auth/link/google_wallet', methods=['POST'])
# @login_required # User should be 'session-logged-in' via Google callback part
# def link_google_wallet():
#     # data = request.get_json()
#     # wallet_address = data.get('walletAddress')
#     # user_id = session['user_id'] (set during Google callback handling)
#     # user = User.query.get(user_id)
#     # user.wallet_address = wallet_address
#     # db.session.commit()
#     pass

@bp.route('/user/details', methods=['POST', 'GET'])  # Added GET to fetch details
# @login_required  # Ensure only logged-in users can access
def user_details():
    user_id = session.get('user_id')
    if not user_id:
        # This should ideally not be reached if @login_required works
        return jsonify({"error": "Authentication required"}), 401

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    if request.method == 'POST':
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        # Validate and update fields (add more validation as needed)
        user.name = data.get('name', user.name)  # Keep old value if not provided

        age_str = data.get('age')
        if age_str is not None:  # Check if age was provided
            if isinstance(age_str, str) and age_str.strip() == "":  # Handle empty string for age
                user.age = None
            else:
                try:
                    age_int = int(age_str)
                    if 0 < age_int < 150:  # Basic age validation
                        user.age = age_int
                    else:
                        # Optionally return error for invalid age range
                        current_app.logger.warning(f"User {user.id} submitted invalid age: {age_str}")
                        user.age = None  # Or keep old value: user.age = user.age
                except ValueError:
                    # Optionally return error for non-integer age
                    current_app.logger.warning(f"User {user.id} submitted non-integer age: {age_str}")
                    user.age = None  # Or keep old value

        user.physical_address = data.get('address', user.physical_address)  # 'address' from frontend form
        user.gender = data.get('gender', user.gender)

        try:
            db.session.commit()
            # Optionally log this action services.log_action_on_chain(user.wallet_address, "User Details Updated",
            # json.dumps({"updated_fields": list(data.keys())}))
            return jsonify({
                "message": "User details updated successfully",
                "user": {  # Return updated details
                    "name": user.name,
                    "age": user.age,
                    "physical_address": user.physical_address,
                    "gender": user.gender,
                    "email": user.email,  # Include other relevant, non-sensitive info
                    "wallet_address": user.wallet_address
                }
            }), 200
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error updating user details for user {user.id}: {e}")
            return jsonify({"error": "Failed to update user details"}), 500

    else:
        return jsonify({
            "name": user.name,
            "age": user.age,
            "physical_address": user.physical_address,
            "gender": user.gender,
            "email": user.email,  # Include other relevant info
            "wallet_address": user.wallet_address
        }), 200


# --- User/Wallet Virtualization (Conceptual - relies on Web3Auth/Magic on client) ---
@bp.route('/user/profile', methods=['GET'])
@login_required
def get_user_profile():
    user = User.query.get(session['user_id'])
    # This is where you'd fetch user-specific data, potentially from IPFS links
    # stored against the user, decrypted client-side.
    return jsonify({
        "email": user.email,
        "wallet_address": user.wallet_address,
    })


@bp.route('/ipfs/<content>', methods=['POST'])
def upload_ipfs(content):
    if content == 'json':
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        result = ipfs.upload_json(data)
        return jsonify(result)

    elif content == 'file':
        if 'file' not in request.files:
            return jsonify({'error': 'No file part in request'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        result = ipfs.upload_file(file)
        if 'error' in result:
            return jsonify(result), 500
        return jsonify(result)

    return 404


async def _get_my_nfts_async():
    try:
        # Read the contract ABI in a background thread
        contract_abi = await asyncio.to_thread(
            lambda: open(Path(__file__).parent / "abi" / current_app.config.get('NFT_LAND_CONTRACT_ABI_PATH'), 'r').read())

        # Set the contract address (replace with your contract's deployed address)
        contract_address = current_app.config.get('NFT_LAND_CONTRACT_ADDRESS')
        nft_land_contract = w3.eth.contract(address=Web3.to_checksum_address(contract_address), abi=contract_abi)

        user = await asyncio.to_thread(User.query.get, session['user_id'])
        if not user.wallet_address:
            return jsonify({"error": "User wallet address not found"}), 400

        if not nft_land_contract:
            return jsonify({"error": "NFTLand contract not configured"}), 503

        # Fetch token IDs using a thread to avoid blocking
        tokenIDs = await asyncio.to_thread(nft_land_contract.functions.fetchNFTsForOwner(user.wallet_address).call)

        # Gather tokenData calls concurrently
        async def get_token_data(tokenID):
            tokenURI = await asyncio.to_thread(nft_land_contract.functions.tokenData(tokenID).call)
            return {'tokenID': tokenID, 'tokenURI': tokenURI}

        tasks = [get_token_data(tokenID) for tokenID in tokenIDs]
        nfts = await asyncio.gather(*tasks)

        return jsonify({"nfts": nfts}), 200

    except Exception as e:
        current_app.logger.error(f"Error fetching NFTs: {e}")
        return jsonify({"error": f"Error fetching NFTs: {e}"}), 500


@bp.route('/nft/my_nfts', methods=['GET'])
@login_required
def get_my_nfts():
    return asyncio.run(_get_my_nfts_async())


# --- NFT Interaction Routes ---
@bp.route('/nft/<int:token_id>', methods=['GET'])
def get_single_nft(token_id):
    result, status_code = services.get_nft_details(token_id)
    return jsonify(result), status_code


# Minting, updating, buying, selling NFTs: These are state-changing operations.
# The backend should prepare the transaction parameters, but the USER MUST SIGN them
# using their wallet (MetaMask or the one from Web3Auth).
# The frontend will use ethers.js/web3.js to send the signed transaction.
# The backend can provide ABI and contract addresses.

@bp.route('/nft/prepare_mint_tx', methods=['POST'])
@login_required
def prepare_mint_tx():
    data = request.get_json()
    metadata_uri = data.get('metadataURI')  # URI to the (potentially encrypted) metadata on IPFS
    recipient_address = session.get('wallet_address')  # Mint to logged-in user

    if not metadata_uri or not recipient_address:
        return jsonify({"error": "Missing metadataURI or recipient address"}), 400

    if not current_app.config.get(
            'NFT_LAND_CONTRACT_ADDRESS') or not services.nft_land_contract:  # Check if contract is loaded
        return jsonify({"error": "NFTLand contract not configured on backend"}), 503

    # Backend prepares transaction data for the client to sign and send This example assumes the `mintNFT` function
    # in `NFTLand.sol` is `onlyOwner` and that owner is the platform. If users mint for themselves, the contract
    # `mintNFT` should not be `onlyOwner` or a different mint function should be used. Let's assume a
    # platform-controlled mint for now, where platform pays gas. OR, if users mint and pay gas: The `to` address
    # would be `recipient_address`. The `from` address (signer) would be `recipient_address`. The frontend would then
    # call `nft_land_contract.methods.mintNFT(recipient_address, metadata_uri).send({from: user_address, ...gas})`

    # This endpoint would typically return:
    # 1. Contract Address
    # 2. Contract ABI (or relevant function signature)
    # 3. Function Name ('mintNFT')
    # 4. Parameters ([recipient_address, metadata_uri(encrypted)])
    # 5. Estimated gas (optional, client can estimate too)

    # For now, let's just return what the client needs to call the contract.
    return jsonify({
        "contract_address": current_app.config['NFT_LAND_CONTRACT_ADDRESS'],
        "function_name": "mintNFT",
        "args": [Web3.to_checksum_address(recipient_address), metadata_uri],  # Ensure metadata_uri is encrypted
        "message": "Client should use these details to construct and sign the transaction."
    }), 200


# --- Marketplace Routes ---
@bp.route('/market/listings', methods=['GET'])
def get_listings():
    # This should ideally pull from an indexed database.
    # services.get_active_listings_from_contract is a placeholder for on-chain (inefficient).
    # For a real app, you'd query your indexed 'ActionLog' or a dedicated 'Listings' table.

    # Replace with actual DB query once indexer is running
    # For now, conceptual:
    # active_listings = YourIndexedMarketplaceListing.query.filter_by(active=True).limit(limit).offset(offset).all()
    # return jsonify([listing.to_dict() for listing in active_listings])
    return jsonify({"message": "Endpoint for indexed listings. Implement DB query.", "data": []})


@bp.route('/market/prepare_list_tx', methods=['POST'])
@login_required
def prepare_list_tx():
    data = request.get_json()
    nft_contract_address = data.get('nftContractAddress')
    token_id = data.get('tokenId', type=int)
    price_matic = data.get('priceMatic', type=float)

    if not all([nft_contract_address, isinstance(token_id, int), isinstance(price_matic, float)]):
        return jsonify({"error": "Missing or invalid parameters"}), 400
    if price_matic <= 0:
        return jsonify({"error": "Price must be positive"}), 400

    price_wei = Web3.to_wei(price_matic, 'ether')

    return jsonify({
        "marketplace_contract_address": current_app.config['NFT_MARKETPLACE_CONTRACT_ADDRESS'],
        "function_name": "listNFT",
        "args": [Web3.to_checksum_address(nft_contract_address), token_id, price_wei],
        "message": "Client should use these details to construct and sign the listNFT transaction."
    }), 200


@bp.route('/market/prepare_unlist_tx', methods=['POST'])
@login_required
def prepare_unlist_tx():
    data = request.get_json()
    nft_contract_address = data.get('nftContractAddress')
    token_id = data.get('tokenId', type=int)

    if not all([nft_contract_address, isinstance(token_id, int)]):
        return jsonify({"error": "Missing or invalid parameters"}), 400

    return jsonify({
        "marketplace_contract_address": current_app.config['NFT_MARKETPLACE_CONTRACT_ADDRESS'],
        "function_name": "unlistNFT",
        "args": [Web3.to_checksum_address(nft_contract_address), token_id],
        "message": "Client should use these details to construct and sign the unlistNFT transaction."
    }), 200


# --- Fiat On-Ramp & Commission Info ---
@bp.route('/utils/fiat_quote', methods=['GET'])
@login_required
def fiat_quote():
    amount_inr = request.args.get('amount_inr', type=float)
    crypto_currency = request.args.get('crypto', 'MATIC')
    user_wallet_address = session.get('wallet_address')
    if not amount_inr:
        return jsonify({"error": "amount_inr parameter is required"}), 400

    result, status = services.get_fiat_onramp_quote(amount_inr, crypto_currency, user_wallet_address)
    return jsonify(result), status


@bp.route('/utils/platform_info', methods=['GET'])
def platform_info():
    return jsonify({
        "commission_percentage_bps": current_app.config.get('MARKETPLACE_COMMISSION_PERCENTAGE_BPS'),
        # e.g. 1000 for 10%
        "commission_wallet_address": current_app.config.get('PLATFORM_COMMISSION_WALLET_ADDRESS')
    })


# --- ADMIN ROUTES ---
@bp.route('/admin/generate_login_url', methods=['GET'])  # Should be protected
# @admin_required # Or some other form of initial admin auth to get this link
def generate_admin_url_endpoint():
    # Add strong authentication here if this endpoint is exposed.
    # E.g. require "master" admin password or API key.
    # For now, assuming it's called from a secure context or for setup.
    return auth.get_admin_login_link()


@bp.route('/admin/login_page/<login_token>', methods=['GET'])  # The dynamic link
def admin_login_page(login_token):
    # This page would be a simple HTML form that then POSTs to /admin/login
    # It should pre-fill the token. The user enters dynamic username, email, pass, OTP.
    # For a true SPA, this might just validate the token and then show the login form components.
    # For simplicity with Flask, can render a template.
    s = URLSafeTimedSerializer(current_app.config['SECRET_KEY'], salt='admin-login-link')
    try:
        token_data = s.loads(login_token, max_age=current_app.config['ADMIN_LOGIN_TOKEN_MAX_AGE'])
        db_token = AdminLoginToken.query.filter_by(token=login_token, used=False).first()
        if not db_token or db_token.expires_at < datetime.now(UTC) or \
                token_data.get("purpose") != "admin_login":
            return "Invalid or expired admin login link.", 400

        # The page can display the expected username challenge if you want, or have user generate it
        # username_challenge = token_data.get("username_challenge")
        return render_template('admin_login_form.html', login_token=login_token)  # Create this HTML template
    except Exception as e:
        return f"{e}", 400


@bp.route('/admin/login', methods=['POST'])
def admin_login_endpoint():
    return auth.admin_login()


@bp.route('/admin/logs', methods=['GET'])
@admin_required
def get_admin_logs():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    search_query = request.args.get('q', None)  # For searching

    query = ActionLog.query.order_by(ActionLog.timestamp.desc())
    if search_query:
        # Basic search across a few fields
        search_term = f"%{search_query}%"
        query = query.filter(
            models.db.or_(
                ActionLog.user_address.ilike(search_term),
                ActionLog.action.ilike(search_term),
                ActionLog.details.ilike(search_term)
            )
        )

    paginated_logs = query.paginate(page=page, per_page=per_page, error_out=False)
    logs_data = [{
        "id": log.id, "log_id_onchain": log.log_id_onchain, "user_address": log.user_address,
        "action": log.action, "details": log.details,
        "timestamp": log.timestamp.isoformat(), "tx_hash": log.tx_hash
    } for log in paginated_logs.items]

    return jsonify({
        "logs": logs_data,
        "total": paginated_logs.total,
        "pages": paginated_logs.pages,
        "current_page": paginated_logs.page
    })


@bp.route('/admin/users', methods=['GET'])
@admin_required
def get_admin_users():
    # Similar pagination and search as logs for User model
    # Exclude password_hash and otp_secret from response
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    search_query = request.args.get('q', None)

    query = User.query
    if search_query:
        search_term = f"%{search_query}%"
        query = query.filter(
            models.db.or_(
                User.email.ilike(search_term),
                User.wallet_address.ilike(search_term)
            )
        )

    paginated_users = query.paginate(page=page, per_page=per_page, error_out=False)
    users_data = [{
        "id": user.id, "email": user.email, "wallet_address": user.wallet_address, "is_admin": user.is_admin
    } for user in paginated_users.items]

    return jsonify({
        "users": users_data,
        "total": paginated_users.total,
        "pages": paginated_users.pages,
        "current_page": paginated_users.page
    })


@bp.route('/admin/nfts_overview', methods=['GET'])
@admin_required
def get_admin_nfts_overview():
    # This would ideally query an indexed database of all minted NFTs.
    # If not, you'd have to iterate on-chain events (NFTMinted from NFTLand)
    # or rely on `totalSupply` and then query each token (very inefficient).
    # Assume you have an `IndexedNFT` model populated by an indexer.
    # For now, placeholder:
    return jsonify({"message": "Admin NFTs overview. Implement with an indexed NFT database."})


@bp.route('/admin/contract_info', methods=['GET'])
@admin_required
def get_admin_contract_info():
    return jsonify({
        "nft_land_contract": {
            "address": current_app.config.get('NFT_LAND_CONTRACT_ADDRESS'),
            "abi_path": Path(__file__).parent / "abi" / current_app.config.get('NFT_LAND_CONTRACT_ABI_PATH'),
            # Could add more details like owner, specific state variables if needed
        },
        "action_logger_contract": {
            "address": current_app.config.get('ACTION_LOGGER_CONTRACT_ADDRESS'),
            "abi_path": Path(__file__).parent / "abi" / current_app.config.get('ACTION_LOGGER_CONTRACT_ABI_PATH'),
        },
        "nft_marketplace_contract": {
            "address": current_app.config.get('NFT_MARKETPLACE_CONTRACT_ADDRESS'),
            "abi_path": Path(__file__).parent / "abi" / current_app.config.get('NFT_MARKETPLACE_CONTRACT_ABI_PATH'),
        }
    })


# You'll need to add this to your Blueprint, typically nft_bp or similar
# For example, if your blueprint is named `bp`:
@bp.route('/nft/prepare_metadata_for_minting', methods=['POST'])
# @login_required # If authentication is needed
def prepare_metadata_for_minting():
    if not request.form:
        return jsonify({"error": "Missing form data"}), 400

    required_fields = [
        'title', 'description', 'external_url', 'plot_id', 'address',
        'google_maps_location', 'size', 'land_use', 'ownership_verified',
        'geo_coordinates', 'survey_number', 'owner_name', 'user_doc_html_content',
        'sale_history_url', 'zone_classification',
        'tokenization_date', 'minter_address'
    ]
    for field in required_fields:
        if field not in request.form:
            return jsonify({"error": f"Missing form field: {field}"}), 400

    required_files = [
        'image', 'ownership_document', 'encumbrances'
    ]
    for file in required_files:
        if file not in request.files:
            return jsonify({"error": f"Missing file {file}"}), 400

    image_file = request.files['image']
    ownership_doc_file = request.files['ownership_document']
    encumbrances_file = request.files['encumbrances']
    user_doc_html_content = request.form['user_doc_html_content']

    try:
        # 1. Upload image to IPFS
        image_ipfs_hash = upload_file_to_ipfs(image_file)
        if "error:" in image_ipfs_hash:
            return jsonify(f"Image upload failed: {image_ipfs_hash}"), 400

        # 2. Upload ownership document to IPFS
        ownership_doc_ipfs_hash = upload_file_to_ipfs(ownership_doc_file)
        if "error:" in ownership_doc_ipfs_hash:
            return jsonify(f"Ownership document upload failed: {ownership_doc_ipfs_hash}"), 400

        # 3. Upload ownership document to IPFS
        encumbrances_ipfs_hash = upload_file_to_ipfs(encumbrances_file)
        if "error:" in encumbrances_ipfs_hash:
            return jsonify(f"Ownership document upload failed: {encumbrances_ipfs_hash}"), 400

        print("uploaded")

        # 4. Create HTML file from rich text content and upload to IPFS
        html_file_content = f"<html><head><meta charset=\"UTF-8\"></head><body>{user_doc_html_content}</body></html>"
        html_file_bytes = io.BytesIO(html_file_content.encode('utf-8'))

        # Create a FileStorage-like object for the HTML content
        # Pinata's upload_file expects a filename.
        html_file_storage = FileStorage(stream=html_file_bytes, filename="user_document.html", content_type="text/html")
        user_doc_ipfs_hash = upload_file_to_ipfs(html_file_storage)
        if "error:" in user_doc_ipfs_hash:
            raise Exception(f"User document HTML upload failed: {user_doc_ipfs_hash}")

        print("uploaded user doc")

        # 5. Construct metadata JSON
        metadata = {
            "title": request.form['title'],
            "description": request.form['description'],
            "image": f"ipfs://{image_ipfs_hash}",
            "external_url": request.form['external_url'],
            "attributes": [
                {"trait_type": "Plot ID", "value": request.form['plot_id']},
                {"trait_type": "Address", "value": request.form['address']},
                {"trait_type": "Google Maps Location", "value": request.form['google_maps_location']},
                {"trait_type": "Size", "value": request.form['size']},
                {"trait_type": "Land Use", "value": request.form['land_use']},
                {"trait_type": "Ownership Verified", "value": request.form['ownership_verified']},
                {"trait_type": "Geo Coordinates", "value": request.form['geo_coordinates']},
                {"trait_type": "Survey Number", "value": request.form['survey_number']}
            ],
            "land_metadata": {
                "owner_name": request.form['owner_name'],
                "ownership_doc_url": f"ipfs://{ownership_doc_ipfs_hash}",
                "user_doc_url": f"ipfs://{user_doc_ipfs_hash}",  # Added as per your requirement
                "sale_history_url": request.form['sale_history_url'],
                "zone_classification": request.form['zone_classification'],
                "encumbrances": f"ipfs://{encumbrances_ipfs_hash}",
                "tokenization_date": request.form['tokenization_date']
            }
        }

        print("constructed")
        # 6. Upload metadata JSON to IPFS
        metadata_ipfs_hash = upload_json_to_ipfs(metadata)
        if "error:" in metadata_ipfs_hash:
            raise Exception(f"Metadata JSON upload failed: {metadata_ipfs_hash}")

        print("uploaded")

        final_token_uri = f"ipfs://{metadata_ipfs_hash}"

        # The minter_address is received but used later by prepare_mint_tx typically
        # minter_address = request.form['minter_address']

        return jsonify(
            {"token_uri": final_token_uri, "message": "Metadata successfully prepared and uploaded to IPFS."}), 200

    except Exception as e:
        # Log the error e
        print(f"Error in prepare_metadata_for_minting: {str(e)}")  # Or use app logger
        return jsonify({"error": str(e)}), 500


@bp.route('/nft/prepare_metadata_for_update', methods=['POST'])
def prepare_metadata_for_update():
    if not request.form:
        return jsonify({"error": "Missing form data"}), 400

    required_fields = [
        'title', 'description', 'external_url', 'plot_id', 'address',
        'google_maps_location', 'size', 'land_use', 'ownership_verified',
        'geo_coordinates', 'survey_number', 'owner_name', 'user_doc_html_content',
        'sale_history_url', 'zone_classification', 'tokenization_date',
        'minter_address',
        # Add fields for existing IPFS URLs
        'existing_image_url',
        'existing_ownership_doc_url',
        'existing_encumbrances_url'
    ]

    for field in required_fields:
        if field not in request.form:
            return jsonify({"error": f"Missing form field: {field}"}), 400

    try:
        # Handle image file or use existing URL
        if 'image' in request.files and request.files['image'].filename:
            image_file = request.files['image']
            image_ipfs_hash = upload_file_to_ipfs(image_file)
            if "error:" in image_ipfs_hash:
                return jsonify(f"Image upload failed: {image_ipfs_hash}"), 400
            image_url = f"ipfs://{image_ipfs_hash}"
        else:
            image_url = request.form['existing_image_url']

        # Handle ownership document or use existing URL
        if 'ownership_document' in request.files and request.files['ownership_document'].filename:
            ownership_doc_file = request.files['ownership_document']
            ownership_doc_ipfs_hash = upload_file_to_ipfs(ownership_doc_file)
            if "error:" in ownership_doc_ipfs_hash:
                return jsonify(f"Ownership document upload failed: {ownership_doc_ipfs_hash}"), 400
            ownership_doc_url = f"ipfs://{ownership_doc_ipfs_hash}"
        else:
            ownership_doc_url = request.form['existing_ownership_doc_url']

        # Handle encumbrances file or use existing URL
        if 'encumbrances' in request.files and request.files['encumbrances'].filename:
            encumbrances_file = request.files['encumbrances']
            encumbrances_ipfs_hash = upload_file_to_ipfs(encumbrances_file)
            if "error:" in encumbrances_ipfs_hash:
                return jsonify(f"Encumbrances upload failed: {encumbrances_ipfs_hash}"), 400
            encumbrances_url = f"ipfs://{encumbrances_ipfs_hash}"
        else:
            encumbrances_url = request.form['existing_encumbrances_url']

        # Handle HTML content
        html_file_content = f'''<html>
                                    <head><meta charset=\"UTF-8\"></head>
                                    <body>{request.form['user_doc_html_content']}</body>
                                </html>'''
        html_file_bytes = io.BytesIO(html_file_content.encode('utf-8'))
        html_file_storage = FileStorage(stream=html_file_bytes, filename="user_document.html", content_type="text/html")
        user_doc_ipfs_hash = upload_file_to_ipfs(html_file_storage)
        if "error:" in user_doc_ipfs_hash:
            raise Exception(f"User document HTML upload failed: {user_doc_ipfs_hash}")

        # Construct metadata JSON
        metadata = {
            "title": request.form['title'],
            "description": request.form['description'],
            "image": image_url,
            "external_url": request.form['external_url'],
            "attributes": [
                {"trait_type": "Plot ID", "value": request.form['plot_id']},
                {"trait_type": "Address", "value": request.form['address']},
                {"trait_type": "Google Maps Location", "value": request.form['google_maps_location']},
                {"trait_type": "Size", "value": request.form['size']},
                {"trait_type": "Land Use", "value": request.form['land_use']},
                {"trait_type": "Ownership Verified", "value": request.form['ownership_verified']},
                {"trait_type": "Geo Coordinates", "value": request.form['geo_coordinates']},
                {"trait_type": "Survey Number", "value": request.form['survey_number']}
            ],
            "land_metadata": {
                "owner_name": request.form['owner_name'],
                "ownership_doc_url": ownership_doc_url,
                "user_doc_url": f"ipfs://{user_doc_ipfs_hash}",
                "sale_history_url": request.form['sale_history_url'],
                "zone_classification": request.form['zone_classification'],
                "encumbrances": encumbrances_url,
                "tokenization_date": request.form['tokenization_date']
            }
        }

        # Upload final metadata JSON to IPFS
        metadata_ipfs_hash = upload_json_to_ipfs(metadata)
        if "error:" in metadata_ipfs_hash:
            raise Exception(f"Metadata JSON upload failed: {metadata_ipfs_hash}")

        final_token_uri = f"ipfs://{metadata_ipfs_hash}"
        return jsonify({
            "token_uri": final_token_uri,
            "message": "Metadata successfully prepared and uploaded to IPFS."
        }), 200

    except Exception as e:
        print(f"Error in prepare_metadata_for_update: {str(e)}")
        return jsonify({"error": str(e)}), 500


@bp.route('/nft/<token_id>/history', methods=['GET'])
def get_nft_history(token_id):
    try:
        # Read the contract ABI in a background thread
        contract_abi = open(Path(__file__).parent / "abi" / current_app.config.get('NFT_LAND_CONTRACT_ABI_PATH'),
                            'r').read()

        # Set the contract address (replace with your contract's deployed address)
        contract_address = current_app.config.get('NFT_LAND_CONTRACT_ADDRESS')
        nft_land_contract = w3.eth.contract(address=Web3.to_checksum_address(contract_address), abi=contract_abi)
        token_id = int(token_id)

        # Get total number of updates
        update_count = nft_land_contract.functions.getUpdateCount(token_id).call()

        # Fetch all versions in reverse chronological order
        history = []
        for i in range(update_count - 1, -1, -1):  # Loop from newest to oldest
            ipfs_uri = nft_land_contract.functions.tokenUpdates(token_id, i).call()
            history.append({
                "version": i + 1,  # Make it 1-based for display
                "update_index": i,
                "token_uri": ipfs_uri,
                "timestamp": "N/A"  # Optional: Add if you have timestamp data
            })

        return jsonify({
            "token_id": token_id,
            "total_updates": update_count,
            "history": history
        })

    except Exception as e:
        current_app.logger.error(f"Error fetching NFT history: {str(e)}")
        return jsonify({"error": str(e)}), 500
