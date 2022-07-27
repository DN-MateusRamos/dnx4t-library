var fs = require('fs');
var path = require('path');
var os = require("os");
var readline = require("readline");
var dir = `${os.homedir}/Documents/dnsxLogs`;


// var STExtensionOutput = StructType({
//     msParName: ref.refType(refArray(ref.types.char, 255)),
//     msParValue: ref.refType(refArray(ref.types.char, 255))
// })

const WebSocket = require("ws")


/**
 * @description Main class of the DNSX library.
 * @example const endpoint = new DNSX('ws://address:port/xfs4iot/version')
 */


class DNSX {

    lib: any
    ws: any;
    testResult: string
    testCase: boolean;
    routerLog: any;
    testName: string;
    unsolicited: boolean;
    uri: string

    constructor(URI: string) {
        
        this.lib
        this.uri = URI
        this.ws
        this.testResult = ""
        this.testCase = true
        this.routerLog = dir
        this.testName = ""
        this.unsolicited = false
    }


    // public rdtoolExtension(){
    //     var path_dll = './RDToolExtension.dll'
    //     this.lib = ffi.Library(path_dll, {
    //         'GetSystemDateTime': [ref.types.int, [ref.refType(ref.types.char), ref.types.ulong, STExtensionOutput, ref.refType(ref.types.ulong)]]
    //     })
    //     var apsInputParameters = ref.alloc(ref.types.char);
    //     var aulNumInPar = 0;
    //     var aptOutputParameters = ref.alloc(STExtensionOutput)
    //     var apNumOutPar = ref.alloc(ref.types.ulong);

    //     return this.lib.GetSystemDateTime(apsInputParameters, aulNumInPar, aptOutputParameters, apNumOutPar)
    // }


    /**
     * @description Wait an unsolicited message for an especific time.
     * @param time Time to wait the unsolicited message. (Milisseconds)
     * @example await endpoint.waitUnsolicited(5000)
     */


    public async waitUnsolicited(time: number) {

        this.unsolicited = true
        let ttl = time / 100
        let control = true
        this.displayMessage('WAITING UNSOLICITED MESSAGE')

        for (let loop = 0; control && loop < ttl; loop++) {

            await this.time()

            try {

                this.ws.onmessage = async (message: any) => {

                    let messageObj = JSON.parse(message.data)

                    if (messageObj.header.type === "unsolicited" && this.unsolicited) {

                        console.log(messageObj)
                        control = false

                    }
                }

            } catch (error) {

            }
        }
    }



    /**
     * @description Function capable to retry the connection initialization.
     * @param socket The WebSocket instance.
     * @param timeout Time to wait the connection to start. (Default: 5000 milisseconds)
     * @returns True if the connection is succesfully started.
     */


    private async connection(socket: any, timeout: number = 5000) {

        const isOpened = () => (socket.readyState === WebSocket.OPEN);

        if (socket.readyState !== WebSocket.CONNECTING) {

            return isOpened;

        }

        else {

            const sleepTimeout: number = 100;
            const ttl: number = timeout / sleepTimeout;


            for (let loop = 0; socket.readyState === WebSocket.CONNECTING && loop < ttl; loop++) {

                await this.time()
                this.ws.onerror = function (event: any) { }

            }

            return isOpened();

        }
    }


    /**
     * @description 
     * @returns 
     */


    private async time() {

        return new Promise(resolve => setTimeout(resolve, 100))

    }


    /**
     * @description Start a WebSocket connection with the URI inserted when create the element.
     * @example await endpoint.startConnection()
     */


    public async startConnection() {

        try {

            if (this.uri.indexOf("ws://") !== -1 || this.uri.indexOf("wss://") !== -1) {

                this.ws = new WebSocket(this.uri);
                this.ws.onerror = function (event: any) {

                };

                let isOpenned = await this.connection(this.ws);

                if (!isOpenned) {

                    this.logComment(`It was not possible to start a connection with: ${this.uri}`)
                    this.displayMessage(`It was not possible to start a connection with: ${this.uri}`)
                    this.testCase = false

                }

            } else {

                this.displayMessage(`INVALID ADDRESS: ${this.uri}`)
                this.logComment(`INVALID ADDRESS: ${this.uri}`)
                this.testCase = false

            }

        } catch (error: any) {

            if (error.name === 'SyntaxError') {

                this.displayMessage(`INVALID URI: ${this.uri}`)
                this.logComment(`INVALID URI: ${this.uri}`)
                this.testCase = false

            }

        }

    }


    /**
     * @description Send a command to the server.
     * @param commandMessage Commmand message to be sent.
     * @example The function can receive the command message from both ways. 
     * 
     * endpoint.send(
     *     "header": {
                "name": "CardReader.Reset",
                "type": "command",
                "requestId": 1
            },
            "payload": {
                "timeout": 1000,
                "to": "exit",
                "storageId": "unit1"
            }
        })

        Or:

        endpoint.send(commandMessage) when the user define the command message variable as a command structure.

     */


    public send(commandMessage: any) {

        try {

            this.ws.send(JSON.stringify(commandMessage));

        } catch (error) {

        }
    }


    /**
     * @description Retrieve the message received according to specified.
     * @param responseType Specifies the command type that will be retrieved. (e.g Completion, Event, Acknowlegde, Unsolicited) 
     * @returns The complete message received according to the specified type.
     * @example const responseReceived = await endpoint.response('completion')
     */


    public async response(responseType: string) {

        try {

            if (this.ws.readyState === WebSocket.OPEN) {

                return new Promise(resolve => {

                    this.ws.onmessage = (message: any) => {

                        let messageObj = JSON.parse(message.data)

                        if (messageObj.header.type === "unsolicited") {

                            this.displayMessage(messageObj)

                        }
                        if (messageObj.header.type === responseType) {

                            resolve(messageObj)

                        } else
                            if (messageObj.header.type === 'acknowledge' && messageObj.payload.status !== 'ok') {

                                this.displayMessage('MESSAGE RECEIVED WAS DIFFERENT FROM EXPECTED')
                                console.log(messageObj)
                                resolve(messageObj)
                                this.testCase = false

                            }

                    }

                })

            }

        } catch (error) {

        }
    }


    /**
     * @description Test the fields of the messages expected with the received.
     * @param responseExpected Message that is expected to be received.
     * @param responseReceived Message received from the server.
     * @param exact This parameter can be True or False. 
     * True: Compare the entire messages structures.
     * False: Check if the message received contains the structure inserted.
     * @example endpoint.testOutput(responseExpected, responseReceived, true)
     * 
     * or
     * 
     * endpoint.testOutput({
            "header": {
                "requestId": 1,
                "type": 'completion',
                "name": 'CardReader.Reset'
            },
            "payload": {
                "completionCode": 'success'
            }
        }, {
            "header": {
                "requestId": 1,
                "type": 'completion',
                "name": 'CardReader.Reset'
            },
            "payload": {
                "completionCode(1)": 'success'
            }
        })
     */


    public testOutput(responseExpected: any, responseReceived: any, exact: boolean) {

        if (!exact) {
            
            try {

                for (let k in responseExpected) {

                    if (responseReceived.hasOwnProperty(k)) {

                        if (typeof responseExpected[k] === "object" && typeof responseReceived[k] === "object") {

                            this.testOutput(responseExpected[k], responseReceived[k], false);

                        }
                        else if (responseExpected[k] !== responseReceived[k]) {

                            this.testCase = false;
                            let comment1 = `WHAT WAS EXPECTED: ${k}: ${responseExpected[k]}`;
                            let comment2 = `WHAT WAS RECEIVED: ${k}: ${responseReceived[k]}`;
                            this.logComment(comment1);
                            this.logComment(comment2);
                            this.displayMessage(comment1);
                            this.displayMessage(comment2);
                        }

                    } else {

                        this.testCase = false;
                        let comment = `IS MISSING: ${k} : ${responseExpected[k]}`;
                        this.logComment(comment);
                        this.displayMessage(comment);

                    }

                }

            } catch (error) {

            }

        }

        else if (responseExpected !== responseReceived) {

            let message = 'THE MESSAGE THAT WAS RECEIVED IS DIFFERENT FROM EXPECTED'
            this.displayMessage(message)
            this.logComment(message)
            this.logComment(responseReceived)
            console.log('\n MESSAGE RECEIVED: \n', responseReceived)
            this.testCase = false;

        }

    }


    /**
     * @description This function allows to ask any information of the user meanwhile the script is on going.
     * @param question A question to be made to the user.
     * @returns The information inserted by the user.
     * @example await endpoint.ask('How is your day?')
     */


    public async ask(question: string) {

        return new Promise(resolve => {

            const r1 = readline.createInterface({

                input: process.stdin,
                output: process.stdout

            });

            r1.question(`\n${question} `, (answer: any) => {

                resolve(answer);
                this.displayMessage(`INFO INSERTED: ${answer}`);
                r1.close();

            })

        })

    }


    /**
     * @description Creates a script log file inside the 'dnsxLogs' folder. (Pattern path -> C://user/Documents/dnsxLogs)
     * @param docName The name of the log created.
     * @param local (Optional) The local where the user wants to store the log created. 
     * @example endpoint.createLog('TestFile.yaml')
     */


    public createLog(docName: string, local?: string) {

        if (!fs.existsSync(dir)) {

            fs.mkdir(dir, (err: any) => {

                if (err) {

                    console.log("It was not possible to create the Log folder", err);

                    return
                }

            })

        }
        if (local !== undefined) {

            this.routerLog = path.resolve(local, docName)

        }

        else {

            this.routerLog = path.resolve(dir, docName)

        }

    }


    /**
     * @description Include a comment in the log created.
     * @param comment Any information that the user wants to include in the log.
     * @example endpoint.logComment('Test Case Started')
     */


    public logComment(comment: string) {

        try {

            fs.appendFileSync(this.routerLog, `${comment}\n`)

        } catch (error) {

        }

    }


    /**
     * @description Initiate a test case. 
     * @param testName Test case name.
     * @example endpoint.beginTestCase('Test Case Name')
     */


    public beginTestCase(testName: string) {

        this.testName = testName
        let testCaseName = `TEST CASE: ${testName}`
        this.logComment(testCaseName)
        this.displayMessage(testCaseName)

    }


    /**
     * @description End the test case, store in the log created and prints on terminal the test case result. 
     * @example endpoint.endTestCase()
     */


    public endTestCase() {

        if (this.testCase === false) {

            this.testResult = 'FAIL'

        } else {

            this.testResult = 'SUCCESS'

        }

        let info = `END TEST CASE: ${this.testName} -> RESULT: ${this.testResult}`
        this.logComment(info)
        this.displayMessage(info)
        this.testResult = ""
        this.testName = ""
        this.testCase = true
        this.unsolicited = false

    }


    /**
     * @description Displays a message on terminal.
     * @param message Any information to be displayed on terminal.
     * @example endpoint.displayMessage('Message to be displayed')
     */


    public displayMessage(message: string) {

        console.log(`\n${message}`)

    }


    /**
     * @description This function end the connection established. 
     * @example endpoint.endConnection()
     */


    public endConnection() {

        try {

            this.ws.close()

        } catch (error) {

        }
    }

    /**
     * @description This functions end the script.
     * @example endpoint.endScript()
     */

    public endScript() {

        process.exit()

    }
}

module.exports = DNSX