
from pathlib import Path #To work with paths and files easier
from cryptography.hazmat.primitives.asymmetric import rsa #To get the cryptography tools that help us to generate the RSA keys
from cryptography.hazmat.primitives import serialization #To get the tools that helps us to serialize the keys to bytes/PEM

#To get the Project root
BASE_DIR = Path(__file__).resolve().parent.parent
#__file__ = Get the file location of generate_keys.py
#.resolve = Makes the root as an absolute path
#.parent = Move to the upper folder (scripts/)
#.parent = Move once again to the upper level (the root project)


#To build the path = project/keys/
KEYS_DIR = BASE_DIR / "keys"

#To define where the private key is gonna get stored = project/keys/private_key.pem
PRIVATE_KEY_PATH = KEYS_DIR / "private_key.pem"

#To define where the public key is gonna get stored = project/keys/private_key.pem
PUBLIC_KEY_PATH = KEYS_DIR / "public_key.pem"



def generate_jwt_keys():
    KEYS_DIR.mkdir(exist_ok=True) #To create the KEYS_DIR folder if it does not exist yet.
                                  #This line exist_ok=True means that the folder exists, do not "raise" an error.

    #To generate RSA private key
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048
    )  #Here the private key is a python object, reason why it's necessary to serialize it to a pem file

    #To serialize the private key
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    )

    #To generate public key from private key
    public_key = private_key.public_key()
    #Here the public key is a python object, reason why it's necessary to serialize it to a pem file

    #To serialize the public key
    public_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    )

    #To save keys in the corresponding folder/path
    PRIVATE_KEY_PATH.write_bytes(private_pem)
    PUBLIC_KEY_PATH.write_bytes(public_pem)

    print("RSA keys generated successfully.")
    print(f"Private key: {PRIVATE_KEY_PATH}")
    print(f"Public key:  {PUBLIC_KEY_PATH}")


#Ensures that generate_keys() is executed only when the script is run directly, and not when the module is imported.
#Prevents the keys from being regenerated automatically when the module is imported, which could overwrite existing keys and invalidate previously issued JWTs
#So we can execute this file in an "isolated" way: python scripts/generate_jwt_keys.py
if __name__ == "__main__":
    generate_jwt_keys()

