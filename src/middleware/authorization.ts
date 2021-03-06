import { Request, Response, NextFunction } from 'express';
import jwt, { TokenExpiredError } from 'jsonwebtoken';

import Encryptr from 'classes/Encryptr';

import { asyncCatch, InvalidTokenError, ExpiredTokenError } from 'errors';
import { User, JWT } from 'database/entities';
// import {  } from 'services/authorization';

import Configuration from 'configuration';

const validateToken = async (token: string): Promise<string | void> => {
    try {
        const foundJwt = await JWT.findOneOrFail({ where: { token } });
        const encryptionKey = Configuration.JWT_ENCRYPTION_KEY;
        const jwtSigningKey = Configuration.JWT_SIGNING_KEY;

        try {
            const decryptedToken = Encryptr.decrypt(foundJwt.token, encryptionKey);
            const rawToken = jwt.verify(decryptedToken, jwtSigningKey) as string;

            if (rawToken) {
                return rawToken;
            }

            throw new Error(rawToken);
        } catch (error) {
            if (error instanceof TokenExpiredError) {
                await JWT.delete(foundJwt.id);
                throw new ExpiredTokenError();
            }
            throw new InvalidTokenError();
        }
    } catch (error) {
        throw new InvalidTokenError();
    }
};

export const authorizeUser = asyncCatch(
    async (req: Request, _res: Response, next: NextFunction) => {
        /**
         * TODO: Clean this up
         *
         * By this point the request object should have the user (as req.user) as well
         * as the sent JWT Bearer token (as req.rawJwt).  This means we should be able
         * to just see if `req.user.token.token` exists
         */
        const token = req.user?.jwt.token;
        if (!token) {
            throw new InvalidTokenError('Authentication token not found.');
        }

        const userId = await validateToken(token);
        if (!userId) {
            throw new InvalidTokenError('Authentication token is invalid.');
        }

        const user = await User.findOne(userId);
        if (!user) {
            throw new InvalidTokenError('Authentication token is invalid: User not found.');
        }

        next();
    },
);
