import fs from 'fs-extra';
import {injectable} from 'inversify';
import {ErrorFactory} from '../../plumbing-base';
import {SampleErrorCodes} from '../errors/sampleErrorCodes';

/*
 * A simple utility to deal with the infrastructure of reading JSON files
 */
@injectable()
export class JsonFileReader {

    /*
     * Do the file reading and return a promise
     */
    public async readData<T>(filePath: string): Promise<T> {

        try {

            // Try the file operation
            const buffer = await fs.readFile(filePath);
            return JSON.parse(buffer.toString()) as T;

        } catch (e) {

            // Report the error including an error code and exception details
            const error = ErrorFactory.createServerError(
                SampleErrorCodes.fileReadError,
                'Problem encountered reading data',
                e.stack);

            // File system errors are a JSON object with the error number
            if (e instanceof Error) {
                error.setDetails(e.message);
            } else {
                error.setDetails(e);
            }

            throw error;
        }
    }
}
