'use strict';

const chai = require('chai');
const chaiEta = require('./chai-eta');
chai.use(chaiEta);
const should = chai.should();

const API_KEY = 'YOUR API KEY';
const API_SECRET = 'YOUR API SECRET';
chai.eta.setApiKey(API_KEY, API_SECRET);


describe('API tests', () => {

    it('simulates an email and waits for it', () => {
        let emailAddress;
        return chai.eta.createEmailAddress()
        .then(_emailAddress => {
            emailAddress = _emailAddress;
            return chai.eta.simulate(emailAddress, 'the subject');
        })
        .then(() => {
            return chai.eta.wait(emailAddress);
        })
        .then(result => {
            result.subject.should.be.eq('the subject');
        });
    }).timeout(10000);

    it('wait first, then send', () => {
        return chai.eta.createEmailAddress()
        .then(emailAddress => {
            return Promise.all([
                //wait for emails
                chai.eta.wait(emailAddress),

                //send emails
                chai.eta.simulate(emailAddress, 'the subject'),
            ]);
        })
        .then(results => {
            console.log('results', results);
            const result = results[0];
            result.subject.should.be.eq('the subject');
        });
    }).timeout(10000);

    it('convenience method for wait first then send', () => {
        return chai.eta.waitForEmail({
            sendFn: (emailAddress) => {
                return chai.eta.simulate(emailAddress, 'the subject');
            },
        })
        .then(result => {
            result.subject.should.be.eq('the subject');
        });
    }).timeout(10000);

    it('convenience method for wait first then send, wait for correct subject', () => {
        return chai.eta.waitForEmail({
            sendFn: (emailAddress) => {
                return chai.eta.simulate(emailAddress, 'wrong subject line')
                .then(sleep(100))
                .then(() => {
                    return chai.eta.simulate(emailAddress, 'correct subject line');
                });
            },
            checkFn: (emailData) => {
                return emailData.subject === 'correct subject line';
            }
        })
        .then(result => {
            result.subject.should.be.eq('correct subject line');
        });
    }).timeout(10000);

    it('timeout should be longer for real-world tests', () => {
        return chai.eta.waitForEmail({
            sendFn: (emailAddress) => {
                return sleep(5000)()
                .then(() => {
                    return chai.eta.simulate(emailAddress, 'correct subject line');
                });
            },
            checkFn: (emailData) => {
                return emailData.subject === 'correct subject line';
            }
        })
        .then(result => {
            result.subject.should.be.eq('correct subject line');
        });
    }).timeout(20000);

});

/**
 * Returns a functino that whene called returns a promise. The promise gets
 * resolved after `milliseconds` time.
 * 
 * @param {number} milliseconds time to wait before resolving the promise
 */
function sleep(milliseconds) {
    return () => {
        return new Promise((resolve, reject) => {
            setTimeout(resolve, milliseconds);
        });
    }
};
