const express = require('express')
const superagent = require('superagent')
const moment = require('moment')
const sgMail = require('@sendgrid/mail')
const fs = require('fs-extra')
const path = require('path')
const nanoid = require('nanoid')

const airport = {
  ARN: 'SE',
  BOM: 'IN',
  BRU: 'BE',
  CDG: 'FR',
  CHS: 'US',
  CLE: 'US',
  DUB: 'IE',
  GRU: 'BR',
  HEL: 'FI',
  HKG: 'CN',
  HND: 'JP',
  ICN: 'KR',
  IAD: 'US',
  LAX: 'US',
  LHR: 'GB',
  OMA: 'US',
  PDX: 'US',
  SFO: 'US',
  SIN: 'SG',
  SYD: 'AU',
  TPE: 'TW',
  YUL: 'CA',
  ZRH: 'CH',
}

const puppeteer = require('puppeteer')

const userz = require('simple-json-database')('images.json')

sgMail.setApiKey(
  'REDACTED

const app = express()

app.use(express.json())

app.use(express.static('public'))

app.get('/z', (req, res) => {
  res.redirect(
    'https://zeit.co/oauth/authorize?client_id=REDACTED',
  )
})

app.get('/b', async (req, res) => {
  const { code } = req.query

  console.log(code)

  let r

  try {
    r = await superagent
      .post('https://api.zeit.co/v2/oauth/access_token')
      .type('form')
      .send({
        client_id: 'REDACTED',
        client_secret: 'REDACTED',
        code,
        redirect_uri: 'https://deltav-zeit.serveo.net/b',
      })
  } catch (e) {
    console.error(e)
  }

  const token = r.body.access_token

  await superagent
    .post('https://api.zeit.co/v1/integrations/webhooks')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'Delta V',
      url: 'https://deltav-zeit.serveo.net/endpoint',
    })

  const r2 = await superagent
    .get('https://api.zeit.co/www/user')
    .set('Authorization', `Bearer ${token}`)

  userz[r2.body.user.uid] = r2.body.user.email

  console.log('done')

  res.send(
    'Integration installed. You can close this page. Emails will show up in your inbox.',
  )
})

async function createScreenshot(url, selector, pagespeed) {
  console.log(url)
  const browser = await puppeteer.launch({ headless: true })
  console.log('launched')

  const phone = false // we redact this part

  let rr
  try {
    const page = await browser.newPage()

    await page.setViewport({
      deviceScaleFactor: 3,
      width: phone ? 640 : 1200,
      height: phone ? 960 : 1200,
    })

    let r
    while (
      (r = await superagent
        .get(url)
        .redirects(0)
        .ok(() => true)).status !== 200
    ) {
      console.log('tested')
      console.log(r.status)
      console.log(Date.now())
      await page.waitFor(300)
    }
    await page.goto(url, { timeout: 300000 })
    console.log('loaded')
    if (pagespeed) {
      await page.waitForSelector(
        '#page-speed-insights > div.main-action > form > div > div > div',
      )
      await page.click(
        '#page-speed-insights > div.main-action > form > div > div > div',
      )
    }
    if (selector) {
      await page.waitForSelector(selector, { timeout: 300000 })
    }
    console.log('selected')
    const em = selector ? await page.$(selector) : page
    await page.waitFor(5000)
    rr = await em.screenshot({ type: 'png' })
    console.log('done')
  } finally {
    await browser.close()
  }
  return rr
}

app.post('/endpoint', async (req, res) => {
  const { body } = req
  console.log(body)

  console.log('Received webhook')

  if (body.type !== 'deployment') {
    return undefined
  }

  const image = await createScreenshot(`https://${body.payload.url}`)

  console.log('Procured image 11')

  const image2 = await createScreenshot(
    `https://developers.google.com/speed/pagespeed/insights/?url=https://${
      body.payload.url
    }`,
    '#page-speed-insights > div.pagespeed-results > div:nth-child(2) > div.result-container > div:nth-child(1) > div.psi-category-wrapper > div',
    true,
  )

  console.log('Procured images')

  const id = nanoid()
  const id2 = nanoid()

  await fs.writeFile(path.resolve(__dirname, '../img', id), image)
  await fs.writeFile(path.resolve(__dirname, '../img', id2), image2)

  console.log('Inserted images into database')

  const date = moment(body.createdAt)

  const countryImg = `https://assets.zeit.co/image/upload/front/flags/${
    airport['now-bru'.substring(4).toUpperCase()]
  }.svg`

  console.log(userz[body.userId])
  sgMail.send({
    to: userz[body.userId],
    from: 'report@deltav.org',
    subject: `New deployment for ${body.payload.name}`,
    html: (await fs.readFile(path.resolve(__dirname, 'template.html'), 'utf8'))
      .replace(/DEPLOYMENT_NAME/g, body.payload.name)
      .replace(/REGION/, body.region)
      .replace(/URL/, body.payload.url)
      .replace(/IMAGE/, `https://deltav-zeit.serveo.net/img/${id}`)
      .replace(/IMAGE2/, `https://deltav-zeit.serveo.net/img/${id2}`)
      .replace(/COUNTRY_IMAGE/, countryImg)
      .replace(/DATE/, date.calendar()),
  })

  console.log('Delivered electronic mail message to recipient')

  res.send('ok')

  return 'hi'
})

app.get('/img/:id', (req, res) => {
  res.type('jpg').sendFile(path.resolve(__dirname, '../img', req.params.id))
})

app.listen(3002)
