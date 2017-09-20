'use strict';

module.exports = (chai, _) => {
    const request = require('request-promise-native');
    const WebSocket = require('ws');

    const BASE_ETA_URL = 'https://emailtestautomation.herokuapp.com/api/v1';
    let etaUrl = BASE_ETA_URL;
    const DEFAULT_WAIT_TIMEOUT = 60000;
    let waitTimeout = DEFAULT_WAIT_TIMEOUT;
    const POLL_INTERVAL = 1000;
    let authHeader = null;

    chai.eta = {
        setApiKey: (key, secret) => {
            authHeader = `Apikey ${key}:${secret}`;
        },

        setApiUrl: (url) => {
            etaUrl = url;
        },

        getApiUrl: () => {
            return etaUrl;
        },

        setWaitTimeout: (timeout) => {
            waitTimeout = timeout;
        },

        createEmailAddress: (name) => {
            if (!authHeader) {
                throw new Error('Api key not set. Use chai.eta.setApiKey(key, secret) to set.');
            }
            const requestOptions = {
                uri: etaUrl + '/addresses',
                method: 'POST',
                headers: {
                    'Authorization': authHeader,
                },
                body: {
                    name: name,
                },
                json: true,
            }
            return request(requestOptions)
            .then(res => {
                console.log(res);
                return Promise.resolve(res.data.emailAddress);
            }, err => {
                return Promise.reject(err);
            });
        },

        waitPoll: (emailAddress) => {
            return poll(emailAddress, waitTimeout)
            .then(data => {
                return Promise.resolve(data);
            }, err => {
                return Promise.reject(err);
            });
        },

        wait: (emailAddress, checkFn) => {
            const ws = new WebSocket(etaUrl + '/ws/poll', {
                headers: {
                    'x-emailaddress': emailAddress,
                },
            });

            ws.on('close', () => {
                console.log('ws connection closed');
            });

            return Promise.race([
                new Promise((resolve, reject) => {
                    setTimeout(() => {
                        reject('timed out waiting for email to arrive');
                    }, waitTimeout);
                }),
                new Promise((resolve, reject) => {
                    ws.on('message', (data, flags) => {
                        console.log('incoming message');
                        console.log(data);
                        const email = JSON.parse(data).data;
                        if (checkFn) {
                            const shouldResolve = checkFn(email);
                            if (shouldResolve) {
                                resolve(email);
                            } else {
                                console.log('not resolving, checkFn didn\'t pass');
                            }
                        } else {
                            resolve(email);
                        }
                    });
                }),
            ]);
        },

        waitForEmail: (config) => {
            return chai.eta.createEmailAddress()
            .then(emailAddress => {
                return Promise.all([
                    //wait for emails
                    chai.eta.wait(emailAddress, config.checkFn),

                    //run test
                    config.sendFn(emailAddress),
                ]);
            })
            .then(results => {
                return Promise.resolve(results[0]);
            });
        },

        simulate: (emailAddress, subject) => {
            if (!authHeader) {
                throw new Error('Api key not set. Use chai.eta.setApiKey(key, secret) to set.');
            }
            const requestOptions = {
                uri: etaUrl + `/addresses/${emailAddress}/emails/simulate`,
                method: 'POST',
                headers: {
                    'Authorization': authHeader,
                },
                body: {
                    subject: subject,
                },
                json: true,
            }
            return request(requestOptions)
            .then(res => {
                console.log(res);
                return Promise.resolve(emailAddress);
            }, err => {
                return Promise.reject(err);
            });
        }
    };

    function sleep(milliseconds) {
        return new Promise((resolve, reject) => {
            setTimeout(resolve, milliseconds);
        });
    }

    function poll(emailAddress, timeout) {
        if (timeout === 0) {
            return Promise.reject('polling timed out');
        }

        const requestOptions = {
            uri: etaUrl + `/addresses/${emailAddress}/poll`,
            method: 'GET',
            headers: {
                'Authorization': authHeader,
            },
            json: true,
        }
        return request(requestOptions)
        .then(res => {
            console.log(res);
            const data = res.data;
            if (data.emails.length == 0) {
                return sleep(POLL_INTERVAL)
                .then(() => {
                    return poll(emailAddress, timeout - POLL_INTERVAL);
                });
            } else {
                return Promise.resolve(res.data);
            }
        })
        ; //don't catch errors, let them fly through
    }
};
