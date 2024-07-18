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
    await new Promise(r => setTimeout(r, 1000));


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

    await page.waitForSelector('div.event__match--twoLine');
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

                // Clicar no H2H não tá funcionando.
                // Tentar clicar no nome do time e ir para a página de results e pegar de lá.

                await page.waitForSelector('div.duelParticipant__home>div.participant__participantNameWrapper>div.participant__participantName');
                const linkHome = await page.$eval('div.duelParticipant__home>div.participant__participantNameWrapper>div.participant__participantName>a', el => el.getAttribute('href'));
                const linkHomeResults = `https://www.flashscore.com${linkHome}results/`;
                //console.log(linkHomeResults);
                await page.goto(linkHomeResults);
                //console.log(`${await page.title()}`);
                await page.waitForSelector('div.event__match--last');
                const jogos = await page.$$('div.event__match--last');
                const linksResults = [];
                const titles = [];
                //Não está exibindo os IDs
                // A ideia é pegar os IDs, montar os links de cada partida anterior e pega o resultado do HT
                
                // Criar uma função separada que recebe um page, uma lista de links, retorna dois inteiros: num de jogos, qtd de gols no ht
                // se o jogo FT for 0x0, nem entra, conta +1 jogo e soma +0 nos gols HT
                // se o jogo FT for != 0x0, entra e procura o score HT

                // Tá funcionado
                for(jogo of jogos){
                    const id = await jogo.$eval('a', el => el.getAttribute('href'));
                    linksResults.push(id);
                }

                console.log(linksResults);
                return 0;



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