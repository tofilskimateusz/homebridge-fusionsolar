import type { PlatformAccessory, Service } from 'homebridge';

import type { ExampleHomebridgePlatform } from './platform.js';

export class FusionsolarAccessory {
  private service: Service;

  constructor(
    private readonly platform: ExampleHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'FusionSolar')
      .setCharacteristic(this.platform.Characteristic.Model, 'Inverter')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.context.device.uniqueId);

    if (accessory.context.device.accessory === 'battery_charging') {
      this.service = this.accessory.getService(this.platform.Service.LightSensor) || this.accessory.addService(this.platform.Service.LightSensor);

      setInterval(() => {
        const accessoryValue = this.platform.getDataById(accessory.context.device.uniqueId).value;
        if (accessoryValue > 0) {
          this.service.updateCharacteristic(this.platform.Characteristic.StatusActive, 1);
          this.service.updateCharacteristic(this.platform.Characteristic.CurrentAmbientLightLevel, accessoryValue*1000);
        } else {
          this.service.updateCharacteristic(this.platform.Characteristic.StatusActive, 0);
          this.service.updateCharacteristic(this.platform.Characteristic.CurrentAmbientLightLevel, 0);
        }
      }, 10000);
    } else if (accessory.context.device.accessory === 'battery_discharging') {
      this.service = this.accessory.getService(this.platform.Service.LightSensor) || this.accessory.addService(this.platform.Service.LightSensor);

      setInterval(() => {
        const accessoryValue = this.platform.getDataById(accessory.context.device.uniqueId).value;
        if (accessoryValue < 0) {
          this.service.updateCharacteristic(this.platform.Characteristic.StatusActive, 1);
          this.service.updateCharacteristic(this.platform.Characteristic.CurrentAmbientLightLevel, Math.abs(accessoryValue)*1000);
        } else {
          this.service.updateCharacteristic(this.platform.Characteristic.StatusActive, 0);
          this.service.updateCharacteristic(this.platform.Characteristic.CurrentAmbientLightLevel, 0);
        }
      }, 10000);
    } else if (accessory.context.device.accessory === 'lightsensor') {
      this.service = this.accessory.getService(this.platform.Service.LightSensor) || this.accessory.addService(this.platform.Service.LightSensor);

      setInterval(() => {
        const accessoryValue = this.platform.getDataById(accessory.context.device.uniqueId).value;
        if (accessoryValue > 0) {
          this.service.updateCharacteristic(this.platform.Characteristic.StatusActive, 1);
          this.service.updateCharacteristic(this.platform.Characteristic.CurrentAmbientLightLevel, accessoryValue*1000);
        } else {
          this.service.updateCharacteristic(this.platform.Characteristic.StatusActive, 0);
        }
      }, 10000);
    } else {
      //battery
      this.service = this.accessory.getService(this.platform.Service.Battery) || this.accessory.addService(this.platform.Service.Battery);
      setInterval(() => {
        const batteryLevel = parseInt(this.platform.getDataById(accessory.context.device.uniqueId).value);
        const isBatteryLow = batteryLevel < this.platform.config.batteryLowLevelPercentage
          ? this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
          : this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;

        const chargingState = this.platform.getDataByCode('battery_power').value > 0
          ? this.platform.Characteristic.ChargingState.CHARGING
          : (
            batteryLevel === 100
              ? this.platform.Characteristic.ChargingState.NOT_CHARGEABLE
              : this.platform.Characteristic.ChargingState.NOT_CHARGING
          );
        this.platform.log.debug('Set chargingState to: ' + chargingState);
        this.service.updateCharacteristic(this.platform.Characteristic.StatusLowBattery, isBatteryLow);
        this.service.updateCharacteristic(this.platform.Characteristic.BatteryLevel, batteryLevel);
        this.service.updateCharacteristic(this.platform.Characteristic.ChargingState, chargingState);
        this.service.updateCharacteristic(this.platform.Characteristic.Name, 'Battery');
      }, 10000);
    }

    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.displayName);
  }
}
