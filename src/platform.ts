/* eslint-disable  @typescript-eslint/no-explicit-any */
/* eslint-disable  @typescript-eslint/no-unused-vars */
import type { API, Characteristic, DynamicPlatformPlugin, Logging, PlatformAccessory, PlatformConfig, Service } from 'homebridge';

import { FusionsolarAccessory } from './platformAccessory.js';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';

import puppeteer from 'puppeteer-extra';
import randomUseragent from 'random-useragent';
import { HTTPRequest, HTTPResponse } from 'puppeteer';

export class ExampleHomebridgePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: Map<string, PlatformAccessory> = new Map();
  public readonly discoveredCacheUUIDs: string[] = [];

  private pvData: {[key: string]: any} = [];
  private browser: any = null;

  constructor(
    public readonly log: Logging,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;
    this.pvData = [];

    this.log.debug('Finished initializing platform:', this.config.name);

    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');

      const isFirstRun = true;
      this.getFusionsolarData(isFirstRun);

      setInterval(() => {
        this.browser!.close();
        this.getFusionsolarData(isFirstRun);
      }, 30 * 60000); //refresh login after 30min
    });
  }

  getFusionsolarData(isFirstRun: boolean) {
    (async () => {
      const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.75 Safari/537.36';

      this.browser = await puppeteer.launch({
        headless: true,
        executablePath: '/usr/bin/chromium-browser',
        devtools: false,
        slowMo: 0,
        args: ['--disable-gpu','--no-sandbox','--no-zygote','--disable-setuid-sandbox',
          '--disable-accelerated-2d-canvas','--disable-dev-shm-usage', '--proxy-server=\'direct://\'',
          '--proxy-bypass-list=*'],
        userDataDir: './user_data',
      });

      const userAgent = randomUseragent.getRandom();
      const UA = userAgent || USER_AGENT;

      const page = await this.browser!.newPage();
      await page.setViewport({
        width: 1920 + Math.floor(Math.random() * 100),
        height: 3000 + Math.floor(Math.random() * 100),
        deviceScaleFactor: 1,
        hasTouch: false,
        isLandscape: false,
        isMobile: false,
      });
      await page.setUserAgent(UA);
      await page.setJavaScriptEnabled(true);
      await page.setDefaultNavigationTimeout(0);

      await page.evaluateOnNewDocument(() => {
        // Pass webdriver check
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });
      });

      await page.evaluateOnNewDocument(() => {
        // Overwrite the `plugins` property to use a custom getter.
        Object.defineProperty(navigator, 'plugins', {
          // This just needs to have `length > 0` for the current test,
          // but we could mock the plugins too if necessary.
          get: () => [1, 2, 3, 4, 5],
        });
      });

      await page.evaluateOnNewDocument(() => {
        // Overwrite the `languages` property to use a custom getter.
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en'],
        });
      });

      await page.goto(String(this.config.appUrl) + '/unisso/login.action', {
        waitUntil: 'networkidle0',
      });

      await page.waitForSelector('input[id="username"]');
      await page.type('input[id="username"]', String(this.config.login));
      await page.waitForSelector('input[id="value"]');
      await page.type('input[id="value"]', String(this.config.password));
      await page.click('#submitDataverify');
      await page.waitForNavigation();

      this.log.debug('Logged in!');

      // enable request interception
      await page.setRequestInterception(true);

      // capture background requests
      page.on('request', (request: HTTPRequest) => {
        request.continue();
      });

      // capture background responses
      page.on('response', async (response: HTTPResponse) => {
        if (response.request().url().includes('energy-flow')) {
          this.log.info('Getting update from FusionSolar...');
          const responseData = await response.json();
          const currentProduction = responseData.data.flow.nodes[0].value;
          const batteryConsumption = responseData.data.flow.nodes[4].value;
          const generalConsumption = responseData.data.flow.nodes[5].value;

          this.pvData['FUSIONSOLAR_' + responseData.data.flow.nodes[0].mocId] = {
            code: 'current_production',
            value: currentProduction,
          };
          this.pvData['FUSIONSOLAR_' + responseData.data.flow.nodes[4].mocId] = {
            code: 'battery_consumption',
            value: batteryConsumption,
          };
          this.pvData['FUSIONSOLAR_' + responseData.data.flow.nodes[5].mocId] = {
            code: 'general_consumption',
            value: generalConsumption,
          };

          let gridImport = 0;
          let gridExport = 0;

          //import from grid
          if (generalConsumption > (currentProduction + batteryConsumption)) {
            //import from grid
            gridImport = generalConsumption - (currentProduction + batteryConsumption);
          } else {
            //export to grid
          }

          //export to grid
          if (generalConsumption > (currentProduction + batteryConsumption)) {
            //import from grid
          } else {
            //export to grid
            gridExport = (currentProduction + batteryConsumption) - generalConsumption;
          }

          this.pvData['FUSIONSOLAR_' + responseData.data.flow.nodes[5].mocId + '_1a'] = {
            code: 'grid_import',
            value: gridImport,
          };

          this.pvData['FUSIONSOLAR_' + responseData.data.flow.nodes[5].mocId + '_1b'] = {
            code: 'grid_export',
            value: gridExport,
          };

          this.pvData['FUSIONSOLAR_' + responseData.data.flow.nodes[4].mocId + '_1'] = {
            code: 'battery_percentage_capacity',
            value: responseData.data.flow.nodes[4].deviceTips.SOC,
          };
          this.pvData['FUSIONSOLAR_' + responseData.data.flow.nodes[4].mocId + '_2'] = {
            code: 'battery_charge_capacity',
            value: responseData.data.flow.nodes[4].deviceTips.CHARGE_CAPACITY,
          };
          this.pvData['FUSIONSOLAR_' + responseData.data.flow.nodes[4].mocId + '_3'] = {
            code: 'battery_discharge_capacity',
            value: responseData.data.flow.nodes[4].deviceTips.DISCHARGE_CAPACITY,
          };
          this.pvData['FUSIONSOLAR_' + responseData.data.flow.nodes[4].mocId + '_4'] = {
            code: 'battery_power',
            value: responseData.data.flow.nodes[4].deviceTips.BATTERY_POWER,
          };
          this.pvData['FUSIONSOLAR_' + responseData.data.flow.nodes[4].mocId + '_5'] = {
            code: 'battery_charging',
            value: responseData.data.flow.nodes[4].deviceTips.BATTERY_POWER,
          };
          this.pvData['FUSIONSOLAR_' + responseData.data.flow.nodes[4].mocId + '_6'] = {
            code: 'battery_discharging',
            value: responseData.data.flow.nodes[4].deviceTips.BATTERY_POWER,
          };

          console.log(this.pvData);
          if (isFirstRun) {
            this.discoverDevices();
            isFirstRun = false;
          }
        }
      });
    })();
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.set(accessory.UUID, accessory);
  }

  discoverDevices() {
    const deviceList = [
      {
        uniqueId: this.getIdByCode('current_production'),
        displayName: 'Production Wh',
        accessory: 'lightsensor',
      },
      {
        uniqueId: this.getIdByCode('general_consumption'),
        displayName: 'House consumption Wh',
        accessory: 'lightsensor',
      },
      {
        uniqueId: this.getIdByCode('grid_import'),
        displayName: 'Import from grid Wh',
        accessory: 'lightsensor',
      },
      {
        uniqueId: this.getIdByCode('grid_export'),
        displayName: 'Export to grid Wh',
        accessory: 'lightsensor',
      },
      {
        uniqueId: this.getIdByCode('battery_charging'),
        displayName: 'Battery charging Wh',
        accessory: 'battery_charging',
      },
      {
        uniqueId: this.getIdByCode('battery_discharging'),
        displayName: 'Battery discharging Wh',
        accessory: 'battery_discharging',
      },
      {
        uniqueId: this.getIdByCode('battery_percentage_capacity'),
        displayName: 'Battery capacity',
        accessory: 'battery',
      },
    ];
    
    for (const device of deviceList) {
      const uuid = this.api.hap.uuid.generate(String(device.uniqueId));
      
      const existingAccessory = this.accessories.get(uuid);

      if (existingAccessory) {
        this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

        new FusionsolarAccessory(this, existingAccessory);
      } else {
        this.log.info('Adding new accessory:', device.displayName);

        const accessory = new this.api.platformAccessory(device.displayName, uuid);
        accessory.context.device = device;
        new FusionsolarAccessory(this, accessory);

        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }

      // push into discoveredCacheUUIDs
      this.discoveredCacheUUIDs.push(uuid);
    }

    for (const [uuid, accessory] of this.accessories) {
      if (!this.discoveredCacheUUIDs.includes(uuid)) {
        this.log.info('Removing existing accessory from cache:', accessory.displayName);
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    }
  }

  getDataByCode(code: string) {
    for (const [index, item] of Object.entries(this.pvData)) {
      if (item.code === code) {
        return item;
      }
    }

    return {};
  }

  getDataById(id: string) {
    for (const [index, item] of Object.entries(this.pvData)) {
      if (index === id) {
        return item;
      }
    }

    return {};
  }

  getIdByCode(code: string) {
    for (const [index, item] of Object.entries(this.pvData)) {
      if (item.code === code) {
        return index;
      }
    }

    return 0;
  }
}
