const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(
    async () => {
        const browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-gpu'
            ]
        });

        const page = await browser.newPage();

        await page.setViewport({ width: 1366, height: 768 });

        const response = await page.goto('http://www.flashscore.com');

        if (response.ok()) {
            await scrapeData(page);
        } else {
            console.log('Página 404.');
        }

        await browser.close();
    }
)();

async function scrapeData(page) {
    const start = Date.now();
    await page.waitForSelector('button.calendar__navigation--tomorrow');
    await page.click('button.calendar__navigation--tomorrow');
    const finishedButton = (await page.$$('div.filters__text--default'))[2]; //[2] é scheduled
    await finishedButton.click();

    //Abrir jogos fechados - Resolver isso!!!

    await page.waitForSelector('div.event__match--twoLine');
    const dados = {
        DATE: [],
        TIME: [],
        HOME: [],
        AWAY: []
    }

    const links = [];

    await page.waitForSelector('div.calendar');
    const dateFull = (await page.$('div.calendar'));
    const date = await dateFull.$eval('button.calendar__datepicker', el => el.innerText.split(' ')[0]);
    console.log(`Coletando jogos do dia ${date}`);

    const eventos = (await page.$$('div.event__match--twoLine'));
    for (evento of eventos) {
        try {
            let link = await evento.$eval('a.eventRowLink', el => el.getAttribute('href'));
            link = link.split('match-summary')[0];
            link = `${link}odds-comparison/1x2-odds/full-time`;
            links.push(link);


        } catch (error) {
            console.log(error);
        }
    }

    for (link of links) {
        try {
            const response = await page.goto(link);
            if (response.ok()) {
                //console.log(`Acesso a página do jogo`);
                let odd = await page.waitForSelector('a[title="1X2"]', { timeout: 500 });
                const home = await page.$eval('div.duelParticipant__home>div.participant__participantNameWrapper>div.participant__participantName', el => el.innerText);
                const away = await page.$eval('div.duelParticipant__away>div.participant__participantNameWrapper>div.participant__participantName', el => el.innerText);
                const dateTime = await page.$eval('div.duelParticipant__startTime', el => el.innerText);
                const date = dateTime.split(' ')[0];
                const time = dateTime.split(' ')[1];
                const countryLeague = await page.$eval('span.tournamentHeader__country', el => el.innerText);
                const country = countryLeague.split(': ')[0];
                const league = countryLeague.split(': ')[1];
                const odds = await page.$$('a.oddsCell__odd  ');
                const oddHome = await odds[0].$eval('span', el => el.innerText);
                const oddDraw = await odds[1].$eval('span', el => el.innerText);
                const oddAway = await odds[2].$eval('span', el => el.innerText);

                // await page.waitForSelector('a[title="Both teams to score"]', {timeout: 500});
                await page.click('a[title="Both teams to score"]');
                const oddsBTTS = await page.$$('a.oddsCell__odd  ');
                const oddBTTSyes = await oddsBTTS[0].$eval('span', el => el.innerText); //[0] yes, [1] no

                // await page.waitForSelector('a[title="Over/Under"]', {timeout: 500});
                await page.click('a[title="Over/Under"]');
                const odds05HT = await page.$$('a.oddsCell__odd  ');
                const odd05HT = await odds05HT[0].$eval('span', el => el.innerText); //[0] over, [1] under

                console.log(`${date} ${time} ${country}: ${league} ${home} x ${away} - ${oddHome} ${oddDraw} ${oddAway} ${oddBTTSyes} ${odd05HT}`);

                //Ao clicar em um jogo da lista do H2H, esse jogo abre em uma nova janela, o que impossibilita do page pegar.
                //Testar o código abaixo para pegar o newPage
                //Não tá funcionando mas também não tá dando erro.

                await page.waitForSelector('a[href="#/h2h');
                await page.click('a[href="#/h2h');
                await page.waitForSelector('a[href="#/h2h/home');
                await page.click('a[href="#/h2h/home');
                //Abrir jogos fechados, clicar no showMore --->>> inserir aqui
                await page.waitForSelector('div.h2h__row ');
                const jogosHome = await page.$$('div.h2h__row ');
                let i = 0;
                for (jogo of jogosHome) {
                    i++;
                    //save target of original page to know that this was the opener:     
                    const pageTarget = page.target();
                    //execute click on first tab that triggers opening of new tab:
                    await jogo.click(); //await page.click('#selector');
                    //check that the first page opened this new page:
                    const newTarget = await browser.waitForTarget(target => target.opener() === pageTarget);
                    //get the new page object:
                    const newPage = await newTarget.page();
                    await newPage.waitForSelector('div.smv__incidentsHeader');
                    const htscore = await newPage.$eval('div.smv__incidentsHeader', el => el.innerText);
                    console.log(htscore);

                }
                console.log(`${i} jogos.`);





                // dados.DATE.push(date);
                // dados.TIME.push(time);
                // dados.HOME.push(home);
                // dados.AWAY.push(away);
                // dados.COUNTRY.push(country);
                // dados.LEAGUE.push(league);
                // dados.ODDHOME.push(oddHome);
                // dados.ODDDRAW.push(oddDraw);
                // dados.ODDAWAY.push(oddAway);
                // dados.ODDBTTSYES.push(oddBTTSYes);
                // dados.ODD05HT.push(odd05HT);

            } else {
                console.log(`Não foi possível acessar a página do jogo`);
            }
        } catch (error) {
            // console.log(`Não foi possível acessar a página do jogo trycatch`);
            // console.log(`Aba odds não encontrada.`);
        }
    }

    // date;time;home;away;country;league;oddHome;oddDraw;oddAway;oddBTTSyes;odd05HT;jogosHome;golsMarcadosHTHome;jogosAway;golsSofridosHTAway

    //console.log(eventos);

    //saveToCSV(dados);
    const end = Date.now();
    console.log(`Tempo: ${(end - start) / 1000} segundos`);
}

function saveToCSV(dados) {

    const header = 'HOME;AWAY;FTHG;FTAG';

    const rows = dados.HOME.map((home, index) => `${home};${dados.AWAY[index]};${dados.FTHG[index]};${dados.FTAG[index]}\n`).join('');

    const csvContent = header + rows;
    const filename = path.join(__dirname, 'datasetflashscore.csv');

    fs.writeFileSync(filename, csvContent, 'utf8');

}