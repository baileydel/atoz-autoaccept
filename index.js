
import puppeteer from 'puppeteer';
import readline from 'readline';
import fetch from 'node-fetch';
import moment from 'moment';
import dotenv from 'dotenv';

dotenv.config();

const user = process.env.USER_ID;
const password = process.env.PASS;
const employee_id = process.env.EMPLOYEE_ID
const type = 'vto';
const ops_link = `https://atoz.amazon.work/api/v1/opportunities/get_opportunities?employee_id=${employee_id}`;

const browser = await puppeteer.launch({
    userDataDir: './data',
    headless: true,
});

let loginTimes = 0;
let loaded = false;

(async () => {
    let times = 0;
    let last = [];
    let ops = [];
    const accept = false;

    const page = await browser.newPage();

    
    while (true) {
        try {
            let response = await page.goto(ops_link)
            times++;
    
            if (!loaded) {
                console.log('******* LOADING *******')
            }
            
            if (times % 50 == 0) {
                console.log(`Refresh #${times}`)
            }
    
            if (!page.url().includes(ops_link)) {
                await login(page);
                continue;
            }
            
            try {
                let body = await response.json();
                let json = body[`${type}Opportunities`];
    
                if (json != undefined) {
                    ops = [];
                    for (let i = 0; i < json.length; i++) {
                        let op = json[i];
            
                        if (!last.includes(op['opportunity_id'])) {
                            last.push(op['opportunity_id']);
                            
                            console.log(getTime(op));

                            if (op['active']) {
                                ops.push(op);
                                sendDiscord(op);
                            }
                        }
                    }
                }
            } catch (e) {}
    
            if (accept && ops.length > 0) {
                await acceptVTO();
            }
    
            if (!loaded) {
                loaded = true;
                console.log('******* LOADING END *******')
            }
            await delay(4000);
        }
        catch(e) {
            console.log(e);
        }
    }
})();

async function acceptVTO() {
    const page = await browser.newPage();
    try {
        console.time('Accepting VTO: ');
    
        await page.goto('https://atoz.amazon.work/voluntary_time_off');
        await delay(1000);

        const linkHandlers = await page.$x("//button[contains(., 'Accept')]");
    
        if (linkHandlers.length > 0) {
            await linkHandlers[0].click();
            console.log('found')


            await delay(300);

            const linkHandlers2 =  await page.$x("//button[contains(., 'Accept VTO')]");

            if (linkHandlers2.length > 0) {
                console.log('able to accept')
                console.log(linkHandlers2);
                await linkHandlers2[0].click();
            }
        } 
  
        await page.screenshot({
            path: `./scrapingbee_homepage.jpg`
        });

        console.timeEnd('Accepting VTO: ');
    }
    catch(e) {
        console.log('Accepting VTO FAILED');
        console.log(e);
    }
    finally {
        await page.screenshot({
            path: `./scrapingbee_homepage.jpg`
        });
        await page.close();
    }
}

function delay(time) {
   return new Promise(function(resolve) { 
       setTimeout(resolve, time)
   });
}

async function login() {
    loginTimes++;
    console.time(`Login #${loginTimes}`);
    
    const page = await browser.newPage();

    await page.goto('https://idp.amazon.work/idp/profile/SAML2/Unsolicited/SSO?providerId=idp-us-west-2.federate.amazon.com&target=us-west-2_P230805164842851PDX9SH9GRTBJ9EN_AgR480ceuAiB9Uz1yBOvGCAw9LSGzYaNWYMMII2q6_UHB8wAKAABAAN0eG4AH1AyMzA4MDUxNjQ4NDI4NTFQRFg5U0g5R1JUQko5RU4AAQAHYXdzLWttcwBLYXJuOmF3czprbXM6dXMtd2VzdC0yOjY0MjM5NzE3MDM1MDprZXkvOGQ3ZWMwZmQtYjA4Yy00YWYyLTg5YzUtMGUyNDNiNjdhNzEzALgBAgEAeKLzKlLcRHbS-w0xD1tUSX_3KYwJqCkVLosFxUmWG1UQAfsHcTa5qHaQZP9wazsxfBQAAAB-MHwGCSqGSIb3DQEHBqBvMG0CAQAwaAYJKoZIhvcNAQcBMB4GCWCGSAFlAwQBLjARBAwgK-aHROuH7vWCIPMCARCAO7C5HgyPcXwDTMBXD9zNW7cCOkT73QFFHQtl7vzi07I8A-2QA8B6dqK5ODt2O-mAnwzT8TK4g465aARzAgAAEACm8oAy4EK3D0XvmgdWIVKQByshesJSgicg9J5DZ_2mLHWp7sdL4dLqKPg__FyW5Tn_____AAAAAQAAAAAAAAAAAAAAAQAAAFp8_WEwnsebt7HIPMuopCTXMxcXxBKyDJ7ngA_yPLopYED5e48agD5cjIamu8RYF8K2Nm_kli3n2vK86aixNoeizAYwtlIRA_gCakx28uA8RAg_2k2oGl38oBI_yqD-IW_4S9XCX65EyEs3&relying_party=atoz.web.prod.clientid', {
        waitUntil: "domcontentloaded",
    }).catch((err) => console.log("error loading url", err));

    try {
        if ((await page.$('#login')) !== null) {
            await page.type("#login", user);
            await page.type('#password', password);
            await page.click('#buttonLogin');
        }

        await page.waitForNavigation({
            waitUntil: "domcontentloaded"
        }).catch((err) => console.log("error loading url", err));


        // Send the 2Fa to our phone
        if ((await page.$('#buttonContinue')) !== null) {
            console.log('Trying to click???')
            await page.click('#buttonContinue')
        }
        else {
            return;
        }

        await page.waitForNavigation({
            waitUntil: "domcontentloaded"
        }).catch((err) => console.log("error loading url", err));
    
        if ((await page.$('#code')) !== null) {
            console.log('*NEEDS 2FA*')
    
            // Get code from user
            const t = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
            
            var code = await new Promise((resolve, reject) => {
                let n;
                t.question('2FA: ', name => {
                    n = name;
                    resolve(n);
                    t.close();
                })
            });
    
            await page.type("#code", code);
            await page.click("#trustedDevice");
            await page.click('#buttonVerifyIdentity');
            await page.waitForNavigation();
        }
        await delay(2000);
    }
    catch (e) {
        console.log(e);
    }
    finally {
        console.timeEnd(`Login #${loginTimes}`);
        await page.close();
    }

}

function sendDiscord(op) {
    let time = getTime(op);
    
    const color = op['active'] ? 5814783  : 0xFF0000;

    let incent = '';

    if (op['is_opportunity_incentivized']) {
        incent = op['incentives']['incentive_value']
    }

    fetch('https://discord.com/api/webhooks/1131584244385316956/Jh9RieXC0TylV-XO0eMVQjEMgVXSUrUCJC4OfwcOQ0yBiJToibEf9h6vyHst2w1oyF3y', {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        "content": null,
        "embeds": [
          {
            "title": `${op['opportunity_type']} Opportunity`,
            "url": `https://atoz.amazon.work/time/optional/${op['opportunity_id']}`,
            "description": `${time}
                            ${incent}`,
            "color": color
          }
        ],
        "attachments": []
      })
    })
    .catch(reason => {
      console.err(reason)
    });
}

function getTime(op) {
    let timestamp1 = moment(op['start_time_local']);
    let timestamp2 = moment(op['end_time_local']);
    
    const duration = moment.duration(moment(timestamp2).diff(moment(timestamp1)));
    const hours = Math.floor(duration.asHours());
    const minutes = duration.minutes();
    
    return `${op['workgroup']}\n${timestamp1.format('dddd, MMM DD')}\n${timestamp1.format('HH:mm')} - ${timestamp2.format('HH:mm')} (${hours} hrs ${minutes} mins)`; 
}