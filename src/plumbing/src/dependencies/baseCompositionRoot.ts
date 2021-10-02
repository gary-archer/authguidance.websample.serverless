import middy from '@middy/core';
import {Container} from 'inversify';
import {Cache} from '../cache/cache';
import {AwsCache} from '../cache/awsCache';
import {BaseClaims} from '../claims/baseClaims';
import {ClaimsProvider} from '../claims/claimsProvider';
import {CustomClaims} from '../claims/customClaims';
import {UserInfoClaims} from '../claims/userInfoClaims';
import {CacheConfiguration} from '../configuration/cacheConfiguration';
import {LoggingConfiguration} from '../configuration/loggingConfiguration';
import {OAuthConfiguration} from '../configuration/oauthConfiguration';
import {BASETYPES} from '../dependencies/baseTypes';
import {LogEntry} from '../logging/logEntry';
import {LoggerFactory} from '../logging/loggerFactory';
import {LoggerFactoryImpl} from '../logging/loggerFactoryImpl';
import {CustomHeaderMiddleware} from '../middleware/customHeaderMiddleware';
import {ExceptionMiddleware} from '../middleware/exceptionMiddleware';
import {LoggerMiddleware} from '../middleware/loggerMiddleware';
import {AccessTokenRetriever} from '../oauth/accessTokenRetriever';
import {JwksRetriever} from '../oauth/jwksRetriever';
import {JwtValidator} from '../oauth/jwtValidator';
import {OAuthAuthenticator} from '../oauth/oauthAuthenticator';
import {OAuthAuthorizer} from '../oauth/oauthAuthorizer';
import {HttpProxy} from '../utilities/httpProxy';

/*
 * Register dependencies to manage cross cutting concerns
 */
export class BaseCompositionRoot {

    private readonly _container: Container;
    private _loggingConfiguration: LoggingConfiguration | null;
    private _oauthConfiguration: OAuthConfiguration | null;
    private _cacheConfiguration: CacheConfiguration | null;
    private _claimsProvider: ClaimsProvider | null;
    private _loggerFactory: LoggerFactoryImpl | null;
    private _httpProxy: HttpProxy | null;

    public constructor(container: Container) {
        this._container = container;
        this._loggingConfiguration = null;
        this._oauthConfiguration = null;
        this._cacheConfiguration = null;
        this._loggerFactory = null;
        this._claimsProvider = null;
        this._httpProxy = null;
    }

    /*
     * Receive logging configuration and use common code for logging and error handling
     */
    public useLogging(
        loggingConfiguration: LoggingConfiguration,
        loggerFactory: LoggerFactory): BaseCompositionRoot {

        this._loggingConfiguration = loggingConfiguration;
        this._loggerFactory = loggerFactory as LoggerFactoryImpl;
        this._loggerFactory.configure(loggingConfiguration);
        return this;
    }

    /*
     * Indicate that we're using OAuth and receive the configuration
     */
    public useOAuth(configuration: OAuthConfiguration): BaseCompositionRoot {

        this._oauthConfiguration = configuration;
        return this;
    }

    /*
     * Consumers of the builder class can provide a constructor function for injecting custom claims
     */
    public withClaimsProvider(provider: ClaimsProvider, configuration: CacheConfiguration) : BaseCompositionRoot {

        this._claimsProvider = provider;
        this._cacheConfiguration = configuration;
        return this;
    }

    /*
     * Receive the HTTP proxy object, which is only used on a developer PC
     */
    public useHttpProxy(httpProxy: HttpProxy): BaseCompositionRoot {
        this._httpProxy = httpProxy;
        return this;
    }

    /*
     * Register base framework dependencies
     */
    public register(): BaseCompositionRoot {

        this._registerBaseDependencies();
        this._registerClaimsDependencies();
        this._registerOAuthDependencies();
        return this;
    }

    public getLoggerMiddleware(): middy.MiddlewareObject<any, any> {
        return new LoggerMiddleware(this._container, this._loggerFactory!);
    }

    public getExceptionMiddleware(): middy.MiddlewareObject<any, any> {
        return new ExceptionMiddleware(this._container, this._loggingConfiguration!);
    }

    public getCustomHeaderMiddleware(): middy.MiddlewareObject<any, any> {
        return new CustomHeaderMiddleware(this._loggingConfiguration!.apiName);
    }

    public getAuthorizerMiddleware(): middy.MiddlewareObject<any, any> {
        return new OAuthAuthorizer(this._container, this._claimsProvider!, this._createOAuthCache());
    }

    /*
     * Register any common code logging dependencies
     */
    private _registerBaseDependencies() {

        // This default per request object will be overridden at runtime
        this._container.bind<LogEntry>(BASETYPES.LogEntry).toConstantValue({} as any);

        // The proxy object is a singleton
        this._container.bind<HttpProxy>(BASETYPES.HttpProxy).toConstantValue(this._httpProxy!);
    }

    /*
     * Register injectable items used for claims processing
     */
    private _registerClaimsDependencies() {

        // These default per request objects will be overridden at runtime
        this._container.bind<BaseClaims>(BASETYPES.BaseClaims).toConstantValue({} as any);
        this._container.bind<UserInfoClaims>(BASETYPES.UserInfoClaims).toConstantValue({} as any);
        this._container.bind<CustomClaims>(BASETYPES.CustomClaims).toConstantValue({} as any);
    }

    /*
     * Register dependencies used for OAuth handling
     */
    private _registerOAuthDependencies() {

        // Create the singleton JWKS client, which caches JWKS keys between requests
        const jwksRetriever = new JwksRetriever(this._oauthConfiguration!, this._httpProxy!);

        // Register singletons
        this._container.bind<OAuthConfiguration>(BASETYPES.OAuthConfiguration)
            .toConstantValue(this._oauthConfiguration!);
        this._container.bind<JwksRetriever>(BASETYPES.JwksRetriever)
            .toConstantValue(jwksRetriever);

        // Register per request objects
        this._container.bind<AccessTokenRetriever>(BASETYPES.AccessTokenRetriever)
            .to(AccessTokenRetriever).inTransientScope();
        this._container.bind<OAuthAuthenticator>(BASETYPES.OAuthAuthenticator)
            .to(OAuthAuthenticator).inTransientScope();
        this._container.bind<JwtValidator>(BASETYPES.JwtValidator)
            .to(JwtValidator).inTransientScope();

        return this;
    }

    /*
     * Different caches are used in AWS and on a developer PC
     */
    private _createOAuthCache(): Cache {

        /*
          import {DevelopmentCache} from '../cache/developmentCache';
          return process.env.IS_LOCAL === 'true' ? new DevelopmentCache() :
          new AwsCache(this._cacheConfiguration!, this._claimsProvider!); */

        return new AwsCache(this._cacheConfiguration!, this._claimsProvider!);
    }
}
