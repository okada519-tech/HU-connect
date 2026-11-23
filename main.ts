enum HUConnectConnector {
    //% block="P0/P14"
    P00P14,
    //% block="P1/P15"
    P01P15,
    //% block="P2/P16"
    P02P16
}

/**
 * Robo Blocksカスタムブロック
 */
//% block="HU connect"
//% color=#4c97fe weight=1 icon="\u21cc" advanced=true
namespace HUConnect {

    const RX_BUFFER_SIZE = 100;                 // UART受信バッファサイズ
    const START_CHAR = '*';                     // UART開始文字
    const END_CHAR = '\n';                      // UART終了文字

    const POLLING_INTERVAL = 1;                 // ポーリング周期[msec.]

    const GROVE_WIFI_GET_TOKEN_TIMEOUT = 30000; // GroveWiFiトークン取得タイムアウト[msec.]
    const GROVE_WIFI_READ_TIMEOUT = 60000;      // GroveWiFi受信タイムアウト[msec.]

    const DO_WORK_INTERVAL = 500;               // バックグラウンド実行周期[msec.]
    const WIFI_CONNECT_TIMEOUT = 30000;         // WiFi接続タイムアウト[msec.]

    const SERVER_URI = "wss://blocks.softbankrobotics.com/ws";  // サーバーURI
    const SERVER_GET_TOKEN_TIMEOUT = 30000;     // サーバー通信トークン取得タイムアウト[msec.]
    const SERVER_MESSAGE_TIMEOUT = 5000;        // サーバーメッセージ受信タイムアウト[msec.]
    const MIN_SEND_VALUE_INTERVAL = 1000;       // データ送信最小周期[msec.]

    ////////////////////////////////////////////////////////////////////////////////
    // Helper functions

    function StringIndexOf(str: string, key: string, index: number): number {
        if (index == 0) {
            return str.indexOf(key);
        }
        else {
            let i = str.substr(index, str.length).indexOf(key);
            if (i >= 0) i += index;
            return i;
        }
    }

    function StringReplace(str: string, fromStr: string, toStr: string): string {
        let i = 0;
        while ((i = StringIndexOf(str, fromStr, i)) >= 0) {
            str = str.substr(0, i) + toStr + str.substr(i + fromStr.length, str.length);
            i += toStr.length;
        }
        return str;
    }

    function ItemEncode(str: string): string {
        let str2 = "";

        for (let i = 0; i < str.length; i++) {
            if (str[i] === '\\') str2 += "\\\\";
            else if (str[i] === '*') str2 += "\\s";
            else if (str[i] === '\n') str2 += "\\n";
            else if (str[i] === ',') str2 += "\\c";
            else str2 += str[i];
        }

        return str2;
    }

    function ItemDecode(str: string): string {
        let str2 = "";

        for (let i = 0; i < str.length; i++) {
            if (str[i] === '\\') {
                if (++i >= str.length) break;
                if (str[i] === '\\') str2 += '\\';
                else if (str[i] === 's') str2 += '*';
                else if (str[i] === 'n') str2 += '\n';
                else if (str[i] === 'c') str2 += ',';
            }
            else {
                str2 += str[i];
            }
        }

        return str2;
    }

    function ParseServerMessage(str: string): { [key: string]: string; } {
        let message: { [key: string]: string; } = {};

        let lines = str.split('\n');
        for (let i = 0; i < lines.length; i++) {
            let items = lines[i].split('\t');
            if (items.length === 2) {
                message[items[0]] = items[1];
            }
        }

        return message;
    }

    ////////////////////////////////////////////////////////////////////////////////
    // SerialInterface

    namespace SerialInterface {

        let AttachedDataReceived = false;
        let ReceivedData: string[] = undefined;

        function DataReceived(): void {
            let str = serial.readUntil(serial.delimiters(Delimiters.NewLine));

            let startIndex = StringIndexOf(str, START_CHAR, 0);
            if (startIndex < 0) return;
            {
                let i: number;
                while ((i = StringIndexOf(str, START_CHAR, startIndex + 1)) >= 0) {
                    startIndex = i;
                }
            }
            str = str.substr(startIndex + 1, str.length);
            if (str.length >= 1) {
                if (str.charAt(str.length - 1) === END_CHAR) {
                    str = str.substr(0, str.length - 1);
                }
            }
