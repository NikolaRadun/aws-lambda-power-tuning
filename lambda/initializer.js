'use strict';

const utils = require('./utils');
const powerValues = process.env.powerValues.split(',');

/**
 * Initialize versions & aliases so we can execute everything in parallel.
 */
module.exports.handler = async(event, context) => {

    const lambdaARN = event.lambdaARN;
    const num = event.num;

    validateInput(lambdaARN, num); // may throw

    // reminder: configuration updates must run sequencially
    // (otherwise you get a ResourceConflictException)
    for (let i = 0; i < powerValues.length; i++){
        const value = powerValues[i];
        const alias = 'RAM' + value;
        const aliasExists = await verifyAliasExistance(lambdaARN, alias);
        // console.log('aliasExists: ' + aliasExists);
        await createPowerConfiguration(lambdaARN, value, alias, aliasExists);
    }

    return 'OK';
};

const validateInput = (lambdaARN, num) => {
    if (!lambdaARN) {
        throw new Error('Missing or empty lambdaARN');
    }
    if (!powerValues.length) {
        throw new Error('Missing or empty env.powerValues');
    }
    if (!num || num < 5) {
        throw new Error('Missing num or num below 5');
    }
};

const verifyAliasExistance = async(lambdaARN, alias) => {
    try {
        await utils.checkLambdaAlias(lambdaARN, alias);
        return true;
    } catch (error) {
        if (error.code === 'ResourceNotFoundException') {
            // OK, the alias isn't supposed to exist
            console.log('OK, even if missing alias ');
            return false;
        } else {
            console.log('error during alias check:');
            throw error; // a real error :)
        }
    }
};

const createPowerConfiguration = async(lambdaARN, value, alias, aliasExists) => {
    try {
        await utils.setLambdaPower(lambdaARN, value);
        const {Version} = await utils.publishLambdaVersion(lambdaARN);
        if (aliasExists) {
            await utils.updateLambdaAlias(lambdaARN, alias, Version);
        } else {
            await utils.createLambdaAlias(lambdaARN, alias, Version);
        }
    } catch (error) {
        if (error.message && error.message.includes('Alias already exists')) {
            // shouldn't happen, but nothing we can do in that case
            console.log('OK, even if: ', error);
        } else {
            console.log('error during inizialization for value ' + value);
            throw error; // a real error :)
        }
    }
};
