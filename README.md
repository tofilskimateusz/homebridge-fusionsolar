<p align="center">

<img src="https://github.com/homebridge/branding/raw/latest/logos/homebridge-wordmark-logo-vertical.png" width="150">

</p>

<span align="center">

# Homebridge FusionSolar integration

</span>

This is a homebridge plugin which integrates with FusionSolar app. It does not require any rest-api account so it's handy when you don't have an option to create one. It uses puppeteer to login directly on FusionSolar web app and gets updates as quick as they appear on web app.

There're several types of accessories created by this plugin:

- Production [Wh] - current PV production (LightSensor)
- Battery Charging [Wh] - current battery charging (LightSensor)
- Battery Discharging [Wh] - current battery discharging (LightSensor)
- House Consumption [Wh] - current general house energy consumption (LightSensor)
- Import from grid [Wh] - amount of energy currently importing from grid
- Export to grid [Wh] - amount of energy currently exporting to grid
- Battery - battery condition (Battery type accessory):
  - Battery level
  - Low status
  - Battery state (charging/not chargable/not charging)

#### This is what we get from FusionSolar
![FusionSolar app data](https://github.com/tofilskimateusz/homebridge-fusionsolar/blob/main/images/fusionsolar-app-screen1.png?raw=true)

#### This is how it looks like in Homebridge
![FusionSolar app data](https://github.com/tofilskimateusz/homebridge-fusionsolar/blob/main/images/homebridge_accessories_screen1.png?raw=true)
### Install

First install chromium:
````shell
sudo apt-get install chromium-browser
````
and then:
```shell
sudo npm install -g homebridge-example-plugin@beta
```

### Sample configuration
```
{
...
    "platforms": [
        {
            "name": "homebridge-fusionsolar",
            "platform": "HomebridgeFusionsolar",
            "appUrl": "https://eu5.fusionsolar.huawei.com",
            "login": "###USER_LOGIN###",
            "password": "###USER_PASSWORD###",
            "batteryLowLevelPercentage": 30,
            "_bridge": {
                "username": "0E:34:1D:26:AA:30",
                "port": 38789
            }
        }
    ]
}
```