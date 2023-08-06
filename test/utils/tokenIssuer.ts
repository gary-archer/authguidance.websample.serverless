import {Guid} from 'guid-typescript';
import {generateKeyPair, exportJWK, KeyLike, SignJWT} from 'jose';

/*
 * A token issuer for testing
 */
export class TokenIssuer {

    private readonly _algorithm: string;
    private _tokenSigningPrivateKey: KeyLike | null;
    private _tokenSigningPublicKey: KeyLike | null;
    private _keyId: string;

    public constructor() {
        this._algorithm = 'RS256';
        this._tokenSigningPrivateKey = null;
        this._tokenSigningPublicKey = null;
        this._keyId = Guid.create().toString();
    }

    /*
     * Create keys for testing
     */
    public async initialize(): Promise<void> {

        const keys = await generateKeyPair(this._algorithm);
        this._tokenSigningPrivateKey = keys.privateKey;
        this._tokenSigningPublicKey = keys.publicKey;
    }

    /*
     * Get the token signing public keys as a JSON Web Keyset
     */
    public async getTokenSigningPublicKeys(): Promise<string> {

        const jwk = await exportJWK(this._tokenSigningPublicKey!);

        jwk.kid = this._keyId;
        jwk.alg = this._algorithm;
        const keys = {
            keys: [
                jwk,
            ],
        };

        return JSON.stringify(keys);
    }

    /*
     * Issue an access token with the supplied subject claim
     */
    public async issueAccessToken(sub: string): Promise<string> {

        const now = Date.now();

        return await new SignJWT( {
            sub,
            iss: 'testissuer.com',
            aud: 'api.mycompany.com',
            scope: 'openid profile https://api.authsamples.com/investments',
        })
            .setProtectedHeader( { kid: this._keyId, alg: this._algorithm } )
            .setIssuedAt(now - 30000)
            .setExpirationTime(now + 30000)
            .sign(this._tokenSigningPrivateKey!);
    }
}
