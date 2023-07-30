import assert from 'assert';
import fs from 'fs-extra';
import {Guid} from 'guid-typescript';
import {LambdaChildProcess} from './utils/lambdaChildProcess.js';
import {TokenIssuer} from './utils/tokenIssuer.js';
import {WiremockAdmin} from './utils/wiremockAdmin.js';

/*
 * Test the API in isolation, without any dependencies on the Authorization Server
 */
describe('OAuth API Tests', () => {

    // The real subject claim values for my two online test users
    const guestUserId  = 'a6b404b1-98af-41a2-8e7f-e4061dc0bf86';
    const guestAdminId = '77a97e5b-b748-45e5-bb6f-658e85b2df91';

    // A class to issue our own JWTs for testing
    const tokenIssuer = new TokenIssuer();
    const wiremockAdmin = new WiremockAdmin(false);

    // The test session ID
    const sessionId = Guid.create().toString();

    /*
     * Initialize resources
     */
    before( async () => {

        // Ensure that we are using the development configuration
        await fs.copy('environments/dev.config.json', 'api.config.json');

        // Create some mock token signing keys for access tokens
        await tokenIssuer.initialize();
        const keyset = await tokenIssuer.getTokenSigningPublicKeys();

        // Use Wiremock to simulate the Authorization Server, so that the API receives mock token signing public keys
        await wiremockAdmin.initialize();
        await wiremockAdmin.registerJsonWebWeys(keyset);
    });

    /*
     * Clean up resources
     */
    after( async () => {
        await wiremockAdmin.unregisterJsonWebWeys();
        await wiremockAdmin.unregisterUserInfo();
    });

    /*
     * Test getting claims
     */
    it ('Get user claims returns a single region for the standard user', async () => {

        // Get an access token for the end user of this test
        const accessToken = await tokenIssuer.issueAccessToken(guestUserId);

        // Register the Authorization Server response
        const mockUserInfo = {
            given_name: 'Guest',
            family_name: 'User',
            email: 'guestuser@mycompany.com',
        };
        await wiremockAdmin.registerUserInfo(JSON.stringify(mockUserInfo));

        // Run the lambda function
        const options = {
            httpMethod: 'GET',
            apiPath: '/investments/userinfo',
            lambdaFunction: 'getUserInfo',
            accessToken,
            sessionId,
        };
        const response = await LambdaChildProcess.invoke(options);

        // Assert results
        assert.strictEqual(response.statusCode, 200, 'Unexpected HTTP status code');
        assert.strictEqual(response.body.regions.length, 1, 'Unexpected regions claim');

    }).timeout(10000);

    /*
     * Test getting claims for the admin user
     */
    it ('Get user claims returns all regions for the admin user', async () => {

        // Get an access token for the end user of this test
        const accessToken = await tokenIssuer.issueAccessToken(guestAdminId);

        // Register the Authorization Server response
        const mockUserInfo = {
            given_name: 'Admin',
            family_name: 'User',
            email: 'guestadmin@mycompany.com',
        };
        await wiremockAdmin.registerUserInfo(JSON.stringify(mockUserInfo));

        // Run the lambda function
        const options = {
            httpMethod: 'GET',
            apiPath: '/investments/userinfo',
            lambdaFunction: 'getUserInfo',
            accessToken,
            sessionId,
        };
        const response = await LambdaChildProcess.invoke(options);

        // Assert results
        assert.strictEqual(response.statusCode, 200, 'Unexpected HTTP status code');
        assert.strictEqual(response.body.regions.length, 3, 'Unexpected regions claim');

    }).timeout(10000);

    /*
     * Test getting companies
     */
    it ('Get companies list returns 2 items for the standard user', async () => {

        // Get an access token for the end user of this test
        const accessToken = await tokenIssuer.issueAccessToken(guestUserId);

        // Register the Authorization Server response
        const mockUserInfo = {
            given_name: 'Guest',
            family_name: 'User',
            email: 'guestuser@mycompany.com',
        };
        await wiremockAdmin.registerUserInfo(JSON.stringify(mockUserInfo));

        // Run the lambda function
        const options = {
            httpMethod: 'GET',
            apiPath: '/investments/companies',
            lambdaFunction: 'getCompanyList',
            accessToken,
            sessionId,
        };
        const response = await LambdaChildProcess.invoke(options);

        // Assert results
        assert.strictEqual(response.statusCode, 200, 'Unexpected HTTP status code');
        assert.strictEqual(response.body.length, 2, 'Unexpected companies list');

    }).timeout(10000);

    /*
     * Test getting companies for the admin user
     */
    it ('Get companies list returns all items for the admin user', async () => {

        // Get an access token for the end user of this test
        const accessToken = await tokenIssuer.issueAccessToken(guestAdminId);

        // Register the Authorization Server response
        const mockUserInfo = {
            given_name: 'Admin',
            family_name: 'User',
            email: 'guestadmin@mycompany.com',
        };
        await wiremockAdmin.registerUserInfo(JSON.stringify(mockUserInfo));

        // Run the lambda function
        const options = {
            httpMethod: 'GET',
            apiPath: '/investments/companies',
            lambdaFunction: 'getCompanyList',
            accessToken,
            sessionId,
        };
        const response = await LambdaChildProcess.invoke(options);

        // Assert results
        assert.strictEqual(response.statusCode, 200, 'Unexpected HTTP status code');
        assert.strictEqual(response.body.length, 4, 'Unexpected companies list');

    }).timeout(10000);

    /*
     * Test getting companies with a malicious JWT
     */
    it ('Get companies list with malicious JWT returns a 401 error', async () => {

        // Get an access token for the end user of this test
        const accessToken = await tokenIssuer.issueMaliciousAccessToken(guestUserId);

        // Run the lambda function
        const options = {
            httpMethod: 'GET',
            apiPath: '/investments/companies',
            lambdaFunction: 'getCompanyList',
            accessToken,
            sessionId,
        };
        const response = await LambdaChildProcess.invoke(options);

        // Assert results
        assert.strictEqual(response.statusCode, 401, 'Unexpected HTTP status code');
        assert.strictEqual(response.body.code, 'unauthorized');

    }).timeout(10000);

    /*
     * Test getting allowed transactions
     */
    it ('Get transactions is allowed for companies that match the regions claim', async () => {

        // Get an access token for the end user of this test
        const accessToken = await tokenIssuer.issueAccessToken(guestUserId);

        // Register the Authorization Server response
        const mockUserInfo = {
            given_name: 'Guest',
            family_name: 'User',
            email: 'guestuser@mycompany.com',
        };
        await wiremockAdmin.registerUserInfo(JSON.stringify(mockUserInfo));

        // Company 2 is associated to the user's USA region
        const options = {
            httpMethod: 'GET',
            apiPath: '/investments/companies/2/transactions',
            lambdaFunction: 'getCompanyTransactions',
            accessToken,
            sessionId,
            pathParameters: {
                id: '2',
            }
        };
        const response = await LambdaChildProcess.invoke(options);

        // Assert results
        assert.strictEqual(response.statusCode, 200, 'Unexpected HTTP status code');
        assert.strictEqual(response.body.transactions.length, 8, 'Unexpected transactions');

    }).timeout(10000);

    /*
     * Test getting unauthorized transactions
     */
    it ('Get transactions returns 404 for companies that do not match the regions claim', async () => {

        // Get an access token for the end user of this test
        const accessToken = await tokenIssuer.issueAccessToken(guestUserId);

        // Register the Authorization Server response
        const mockUserInfo = {
            given_name: 'Guest',
            family_name: 'User',
            email: 'guestuser@mycompany.com',
        };
        await wiremockAdmin.registerUserInfo(JSON.stringify(mockUserInfo));

        // Company 3 is associated to a region the user is not authorized to access
        const options = {
            httpMethod: 'GET',
            apiPath: '/investments/companies/3/transactions',
            lambdaFunction: 'getCompanyTransactions',
            accessToken,
            sessionId,
            pathParameters: {
                id: '3',
            }
        };
        const response = await LambdaChildProcess.invoke(options);

        // Assert results
        assert.strictEqual(response.statusCode, 404, 'Unexpected HTTP status code');
        assert.strictEqual(response.body.code, 'company_not_found', 'Unexpected error code');

    }).timeout(10000);

    /*
     * Rehearse an API 500 error
     */
    it ('API exceptions return 500 with a supportable error response', async () => {

        // Get an access token for the end user of this test
        const accessToken = await tokenIssuer.issueAccessToken(guestUserId);

        // Register the Authorization Server response
        const mockUserInfo = {
            given_name: 'Guest',
            family_name: 'User',
            email: 'guestuser@mycompany.com',
        };
        await wiremockAdmin.registerUserInfo(JSON.stringify(mockUserInfo));

        // Company 3 is associated to a region the user is not authorized to access
        const options = {
            httpMethod: 'GET',
            apiPath: '/investments/companies/2/transactions',
            lambdaFunction: 'getCompanyTransactions',
            accessToken,
            sessionId,
            pathParameters: {
                id: '4',
            },
            rehearseException: true,
        };
        const response = await LambdaChildProcess.invoke(options);

        // Assert results
        assert.strictEqual(response.statusCode, 500, 'Unexpected HTTP status code');
        assert.strictEqual(response.body.code, 'exception_simulation', 'Unexpected error code');

    }).timeout(10000);
});
