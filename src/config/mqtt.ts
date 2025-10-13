import mqtt from 'mqtt';

export const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || "mqtt://fogueira-magica.com";
export const MQTT_SUBSCRIBE_TOPIC = "fatec/atmos/mongo/processar/";

export function connectToMqtt() {
    const client = mqtt.connect(MQTT_BROKER_URL);
    return client;
}
