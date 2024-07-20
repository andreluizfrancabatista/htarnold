const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { title } = require('process');

(
    async () => {
        const browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-gpu',
                '--start-maximized'
            ]
        });

        const page = await browser.newPage();

        await page.setViewport({ width: 1366, height: 768 });

        const response = await page.goto('https://www.flashfootball.com/');

        //testes da funcao getGolsHome - Funciona perfeito aqui!
        // const links = ['https://www.flashfootball.com/match/f5SlpABj/#/match-summary/match-summary',
        //     'https://www.flashfootball.com/match/fRZxamRh/#/match-summary/match-summary',
        //     'https://www.flashfootball.com/match/lUWIFiDN/#/match-summary/match-summary'
        // ];
        // for (const linkEvent of links){
        //     const gols = await getGolsHome(page, linkEvent);
        //     console.log(`Gols: ${gols}`);
        // }
        //fim dos testes

        if (response.ok()) {
            await scrapeData(page);
        } else {
            console.log('Página 404.');
        }

        await browser.close();
    }
)();

async function getGolsHome(page, linkEvent) {
    // Acessa um único evento (partida) e retorna quantos gols o mandante (home) fez no HT
    try {
        await page.goto(linkEvent);
        await page.waitForSelector('div.smv__incidentsHeader');
        const score = await page.$eval('div.smv__incidentsHeader>div:nth-child(2)', el => el.innerText);
        const gols = parseInt(score.split(' - ')[0]);
        return gols;
    } catch (error) {
        console.log(`Erro na função getGolsHome: ${error}`);
    }
}

async function getHTScores(page, linkTeam, home_away) {
    //Page é a instância do browser.
    //linkTeam é o link de cada time, para entrar na página de results
    //home_away indica se o time analisado jogará em home ou away
    try {
        await page.goto(linkTeam);
        await page.waitForSelector('div.heading__name');
        const team = await page.$eval('div.heading__name', el => el.innerText); //Qual time está sendo analisado?
        await page.waitForSelector('div.event__match--twoLine');
        const jogos = await page.$$('div.event__match--twoLine');
        const limit = 20; //Quantidade de jogos passados analisados (home + away)
        let count = 0;
        const links = [];
        for (const [i, jogo] of jogos.entries()) {
            if (count > limit) {
                break;
            }
            const homeTeam0 = await jogo.$eval('div.event__homeParticipant', el => el.innerText);// Fazer o tratamento dos jogos internacionais (Arg), (Bra), (Uru), ...
            const homeTeam = homeTeam0.split(" (")[0];
            const awayTeam0 = await jogo.$eval('div.event__awayParticipant', el => el.innerText);// Fazer o tratamento dos jogos internacionais (Arg), (Bra), (Uru), ...
            const awayTeam = awayTeam0.split(" (")[0];
            const scoreHome = parseInt(await jogo.$eval('div.event__score--home', el => el.innerText));
            //const scoreAway = await jogo.$eval('div.event__score--away', el => el.innerText);
            const linkEvent = await jogo.$eval('a.eventRowLink', el => el.getAttribute('href'));
            if (home_away == 'home') {
                if (homeTeam == team) {
                    //gols marcados no HT pelo home jogando home
                    if (scoreHome < 0.5) {
                        links.push(null);
                    } else {
                        links.push(linkEvent);
                    }
                }
                count++;
            }
            if (home_away == 'away') {
                if (awayTeam == team) {
                    //gols sofridos no HT pelo away jogando away
                    if (scoreHome < 0.5) {
                        links.push(null);
                    } else {
                        links.push(linkEvent);
                    }
                }
                count++;
            }
        }
        //const arr = [golsHT, totalJogos];
        const arr = links;
        return arr;
    } catch (error) {
        console.log(`Erro na função getHTscores: ${error}`);
    }
}

async function scrapeData(page) {
    const start = Date.now();
    await Promise.all([
        await page.waitForSelector('button.calendar__navigation--tomorrow'),
        //await page.click('button.calendar__navigation--tomorrow'),
        //await new Promise(r => setTimeout(r, 2000))
    ]);

    const finishedButton = (await page.$$('div.filters__text--default'))[1]; //[1] é scheduled
    await Promise.all([
        //await finishedButton.click(),
        //await new Promise(r => setTimeout(r, 2000))
    ]);

    //Abrir jogos fechados - Resolver isso!!!

    await page.waitForSelector('div.event__match--twoLine');

    const dados = {
        DATE: [],
        TIME: [],
        HOME: [],
        AWAY: [],
        COUNTRY: [],
        LEAGUE: [],
        ODDHOME: [],
        ODDDRAW: [],
        ODDAWAY: [],
        ODDBTTSYES: [],
        ODD05HT: [],
        GOLSHTHOME: [],
        JOGOSHOME: [],
        GOLSHTAWAY: [],
        JOGOSAWAY: []
    }

    const links = [];

    await page.waitForSelector('div.calendar');
    const dateFull = (await page.$('div.calendar'));
    const date = await dateFull.$eval('button.calendar__datepicker', el => el.innerText.split(' ')[0]);
    console.log(`Coletando jogos do dia ${date}`);

    await page.waitForSelector('div.event__match--twoLine');
    const eventos = (await page.$$('div.event__match--twoLine'));
    const limit = 5; //Quantidade de jogos no CSV
    for (const [i, evento] of eventos.entries()) {
        // if (i > limit) {
        //     break;
        // }
        try {
            let link = await evento.$eval('a.eventRowLink', el => el.getAttribute('href'));
            link = link.split('match-summary')[0];
            link = `${link}odds-comparison/1x2-odds/full-time`;
            links.push(link);
        } catch (error) {
            console.log(error);
        }
    }

    const formatDate = date => date.replace(/\./g, '/');
    const formatOdd = odd => odd.replace(/\./g, ',');
    const countries = ['ARGENTINA', 'BRAZIL', 'BELGIUM', 'BOLIVIA', 'BULGARIA', 'CANADA', 'CHILE', 'CHINA', 'COLOMBIA', 'COSTA RICA', 'DENMARK', 'ECUADOR', 'ESTONIA', 'FINLAND', 'GERMANY', 'ICELAND', 'JAPAN', 'MEXICO', 'NORWAY', 'PARAGUAY', 'PERU', 'POLAND', 'SCOTLAND', 'SOUTH KOREA', 'SWEDEN', 'USA', 'WALES'];
    for (const link of links) {
        const response = await page.goto(link);
        if (response.ok()) {
            //console.log(`Acesso a página do jogo`);
            try {
                //let odd = await page.waitForSelector('a[title="1X2"]', { timeout: 500 });
                const duel = await page.waitForSelector('div.duelParticipant__home');
                const home0 = await page.$eval('div.duelParticipant__home>div.participant__participantNameWrapper>div.participant__participantName', el => el.innerText);
                const home = home0.split(" (")[0];
                const away0 = await page.$eval('div.duelParticipant__away>div.participant__participantNameWrapper>div.participant__participantName', el => el.innerText);
                const away = away0.split(" (")[0];
                const dateTime = await page.$eval('div.duelParticipant__startTime', el => el.innerText);
                const date = formatDate(dateTime.split(' ')[0]);
                const time = dateTime.split(' ')[1];

                // Get text from all spans with the selector "span._overline_1xjjm_4"
                const countryLeague = await page.$$eval('span._overline_1xjjm_4', spans => spans.map(span => span.innerText));
                const country = countryLeague[0];
                if (countries.includes(country)){

                } else {
                    continue;
                }
                const league = countryLeague[1];

                await page.waitForSelector('a.oddsCell__odd  ');
                const odds = await page.$$('a.oddsCell__odd  ');
                const oddHome = formatOdd(await odds[0].$eval('span', el => el.innerText));
                const oddDraw = formatOdd(await odds[1].$eval('span', el => el.innerText));
                const oddAway = formatOdd(await odds[2].$eval('span', el => el.innerText));

                await Promise.all([
                    await page.waitForSelector('a[title="Both teams to score"]', { timeout: 2000}),
                    await page.click('a[title="Both teams to score"]'),
                    await page.waitForSelector('a.oddsCell__odd  ')
                ]);
                const oddsBTTS = await page.$$('a.oddsCell__odd  ');
                const oddBTTSyes = formatOdd(await oddsBTTS[0].$eval('span', el => el.innerText)); //[0] yes, [1] no

                await Promise.all([
                    await page.waitForSelector('a[title="Over/Under"]', { timeout: 2000}),
                    await page.click('a[title="Over/Under"]'),
                    await page.waitForSelector('a[title="1st Half"]', { timeout: 2000})
                ]);

                await Promise.all([
                    await page.waitForSelector('a[title="1st Half"]', { timeout: 2000}),
                    await page.click('a[title="1st Half"]'),
                    await page.waitForSelector('a.oddsCell__odd  ')
                ]);

                await page.waitForSelector('a.oddsCell__odd  ');
                const odds05HT = await page.$$('a.oddsCell__odd  ');
                const odd05HT = formatOdd(await odds05HT[0].$eval('span', el => el.innerText)); //[0] over, [1] under

                await page.waitForSelector('div.duelParticipant__home>div.participant__participantNameWrapper>div.participant__participantName');
                const linkHome = await page.$eval('div.duelParticipant__home>div.participant__participantNameWrapper>div.participant__participantName>a', el => el.getAttribute('href'));
                const linkHomeResults = `https://www.flashfootball.com${linkHome}results/`;
                const linkAway = await page.$eval('div.duelParticipant__away>div.participant__participantNameWrapper>div.participant__participantName>a', el => el.getAttribute('href'));
                const linkAwayResults = `https://www.flashfootball.com${linkAway}results/`;


                //Tentar buscar os ht scores por meio dessa função separada
                const arrHome = await getHTScores(page, linkHomeResults, 'home');
                let totalJogosHome = 0;
                let golsHTHome = 0;
                for (const link of arrHome) {
                    if (link == null) {
                        totalJogosHome++;
                    } else {
                        totalJogosHome++;
                        const gols = await getGolsHome(page, link);
                        golsHTHome += gols;
                    }
                }
                //console.log(`${home} ${golsHTHome}/${totalJogosHome}`);
                //
                const arrAway = await getHTScores(page, linkAwayResults, 'away');
                let totalJogosAway = 0;
                let golsHTAway = 0;
                for (const link of arrAway) {
                    if (link == null) {
                        totalJogosAway++;
                    } else {
                        totalJogosAway++;
                        const gols = await getGolsHome(page, link);
                        golsHTAway += gols;
                    }
                }
                //console.log(`${away} ${golsHTAway}/${totalJogosAway}`);

                // date;time;home;away;country;league;oddHome;oddDraw;oddAway;oddBTTSyes;odd05HT;golsMarcadosHTHome;jogosHome;golsSofridosHTAway;jogosAway
                console.log(`${date};${time};${country};${league};${home};${away};${oddHome};${oddDraw};${oddAway};${oddBTTSyes};${odd05HT};${golsHTHome};${totalJogosHome};${golsHTAway};${totalJogosAway}`);

                dados.DATE.push(date);
                dados.TIME.push(time);
                dados.HOME.push(home);
                dados.AWAY.push(away);
                dados.COUNTRY.push(country);
                dados.LEAGUE.push(league);
                dados.ODDHOME.push(oddHome);
                dados.ODDDRAW.push(oddDraw);
                dados.ODDAWAY.push(oddAway);
                dados.ODDBTTSYES.push(oddBTTSyes);
                dados.ODD05HT.push(odd05HT);
                dados.GOLSHTHOME.push(golsHTHome);
                dados.JOGOSHOME.push(totalJogosHome);
                dados.GOLSHTAWAY.push(golsHTAway);
                dados.JOGOSAWAY.push(totalJogosAway);

                //Até aqui dá certo. Ajustar o CSV.

            } catch (error) {
                console.log(`Erro na função scrape data: ${error} `);
            }

        } else {
            console.log(`Não foi possível acessar a página do jogo`);
        }

    }

    saveToCSV(dados);

    const end = Date.now();
    const msToHMS = ms => ({ h: Math.floor(ms / 3600000), m: Math.floor(ms / 60000 % 60), s: Math.floor(ms / 1000 % 60) });
    const { h, m, s } = msToHMS(end - start);
    console.log(`Tempo: ${h} horas, ${m} minutos, ${s} segundos`);
}

function saveToCSV(dados) {

    const header = 'DATE;TIME;HOME;AWAY;COUNTRY;LEAGUE;ODDHOME;ODDDRAW;ODDAWAY;ODDBTTSYES;ODD05HT;GOLSHTHOME;JOGOSHOME;GOLSHTAWAY;JOGOSAWAY\n';

    const rows = dados.HOME.map((home, index) => `${dados.DATE[index]};${dados.TIME[index]};${home};${dados.AWAY[index]};${dados.COUNTRY[index]};${dados.LEAGUE[index]};${dados.ODDHOME[index]};${dados.ODDDRAW[index]};${dados.ODDAWAY[index]};${dados.ODDBTTSYES[index]};${dados.ODD05HT[index]};${dados.GOLSHTHOME[index]};${dados.JOGOSHOME[index]};${dados.GOLSHTAWAY[index]};${dados.JOGOSAWAY[index]}\n`).join('');

    const formatDate = date => date.replace(/\//g, '-');
    const formattedDate = formatDate(dados.DATE[0]);
    
    const csvContent = header + rows;
    const filename = path.join(__dirname, `ht_arnold_${formattedDate}.csv`);

    fs.writeFileSync(filename, csvContent, 'utf8');

}