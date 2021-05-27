// importing vscode api
import * as vscode from 'vscode';
// importing io module from socketio client
import { io, Socket } from 'socket.io-client';
let roomId: string;
let globalActiveDocument: vscode.TextDocument | null;
let globalChangeEventListener: vscode.Disposable;
let areEventListenersActive: boolean = false;
let extensionSocket: Socket;

import * as statusbar from './statusbar';

async function connectAndShare() {
    console.log(`> called connectAndShare`);
    try {
        const connectionReturn = await startConnection();
        console.log(`> startConnection resolved: ${connectionReturn}`);
        console.log(`> Now sharing file...`);
        shareFile();
    } catch (e) {
        console.log(`> startConnection rejected: ${e}`);
    }
}

function startConnection() {
    console.log("> Called startConnectionCommand");
    // this will be taken away in production, since we will only be connecting to my server

    return new Promise((resolve, reject) => {
        // some important logic here:
        // if the socket is undefined, that means we've never connected before, so it's valid to form a new connection
        // if the socket is already defined, we have to check if it is connected or not, using the socket.connected property
        if(extensionSocket !== undefined) {
            // if we're here, that means the socket exists and has at some point been connected
            // check if it is currently connected
            // my thinking: if it's been connected before, then roomId should be defined
            console.log(`> startConnectionCommand: socket is already active.`);
            // TODO: not sure what to do about this logic about roomId
            if(roomId === undefined) {
                console.log(`> startConnectionCommand: socket is/has existed but roomId is undefined!`);
            } else {
                console.log(`> startConnectionCommand: socket is/has existed and roomId is ${roomId}`);
            }

            if(extensionSocket.connected) {
                console.log(`> startConnectionCommand: socket is active and is currently connected.`);
                vscode.window.showInformationMessage("SideWindow: You are already connected.");
                resolve("already connected!");
                return;
            }
            else {
                // in this case, it is not connected so we can go ahead and redo the connection, and assign extensionSocket to it
                console.log(`> startConnectionCommand: socket exists but is not currently connected.`);
                // so we can continue
            }
        }
        // if we've arrived here, then either:
        // - extensionSocket is undefined, i.e. never connected before
        // - or extensionSocket has been defined but is currently not connected

        const showInputBoxOptions = {
            ignoreFocusOut: true,
            password: false,
            // placeHolder: "https://sidewindow.herokuapp.com",
            // value: "https://sidewindow.herokuapp.com",
            placeHolder: "http://localhost:5000",
            value: "http://localhost:5000",
            prompt: "server to connect to",
            valueSelection: undefined
        };

        console.log("> startConnectionCommand: Now prompting user for input");
        const connectionAddrInput = vscode.window.showInputBox(showInputBoxOptions);

        // doing a showQuickPick with 'yes/no'
        const showQuickPickOptions: vscode.QuickPickOptions = {
            title: "Connect to SideWindow? This will share the current active editor contents.",
            canPickMany: false,
            ignoreFocusOut: false,
        }

        const quickPickConnect = vscode.window.showQuickPick(["Yes", "No"], showQuickPickOptions);
        const connectionAddr = "https://sidewindow.herokuapp.com";

        // connectionAddrInput.then((connectionAddr) => {
        quickPickConnect.then((quickPickResponse) => {
            // determine what to do with input
            // again, this will not be available in production
            // if(connectionAddr === undefined) {
            if(quickPickResponse === undefined) {
                console.log("> startConnectionCommand: input box was closed.");
                return;
            }
            // else if(connectionAddr === "") {
            else if(quickPickResponse === "No") {
                // console.log("> startConnectionCommand: empty connectionAddr. Returning.");
                console.log("> startConnectionCommand: Use chose to not connect. Returning.");
                return;
            }
            else {
                console.log(`> startConnectionCommand: attempting to connect to ${connectionAddr}`);
                vscode.window.showInformationMessage("Now connecting to SideWindow...")

                const extensionSocketOptions = {
                    reconnection: true,
                    reconnectionDelay: 1000,
                    reconnectionDelayMax: 5000,
                    timeout: 20000,
                    query: {
                        type: "extension",
                    }
                };

                extensionSocket = io(connectionAddr, extensionSocketOptions);

                if(extensionSocket === undefined) {
                    console.log(`> startConnectionCommand: ERROR - connection failed mysteriously!`);
                    return;
                } 
                else {

                    console.log(`> startConnectionCommand: DEBUG - code is reached`);
                    // get room code from extension

                    extensionSocket.on("connect_error", (error) => {
                        reject(`REJECT - Error connecting!: ${error}`);
                        console.log(`> socket: received a connection error: ${error}`);
                        console.log(`> Now disconnecting...`);
                        vscode.window.showErrorMessage("SideWindow: Error connecting to server.");
                        extensionSocket.disconnect();
                    });

                    extensionSocket.on("connect", () => {
                        console.log(`> socket: connected to server at ${connectionAddr})`);
                        console.log(`> socket: this socket id is ${extensionSocket.id}`);
                        roomId = extensionSocket.id.slice(0, 4);
                        console.log(`> startConnectionCommand: room_id is ${roomId}`);
                        console.log(`> socket: connected to room ${roomId}`);
                        vscode.window.showInformationMessage(`SideWindow: Connected to room ${roomId}`, {modal: false});

                        // TODO: update status bar item
                        statusbar.initializeStatusBarItem(roomId);
                        resolve("RESOLVE - connection ready!");
                    });

                    extensionSocket.on("disconnect", (msg) => {
                        console.log(`> socket: disconnect event received! We've been disconnected`);
                        console.log(`> socket: disconnect message is ${msg}`);
                        vscode.window.showInformationMessage(`SideWindow: You have been disconnected. Reason: ${msg}.`, {modal: true});

                        // let disconnect function handle the disconnection behaviour
                        disconnect();
                        // extensionSocket.disconnect();
                        // disposeStatusBarItem();
                        // statusbar.changeStatusBarItem("disconnected");
                    });

                    // extensionSocket.onAny((ev, arg) => {
                    // 	console.log(`> socket: [GENERAL] received event ${ev} with args ${arg}`);
                    // });

                    // the "source:event" format will be used in the future
                    extensionSocket.on("browser:msg", (msg) => {
                        console.log(`> socket: received message '${msg} from a browser`);
                        vscode.window.showInformationMessage(`Received message: ${msg}`);
                    });


                    extensionSocket.on("browser:request-edit", (msg) => {
                        console.log("> socket: got 'request-edit'");
                        while(globalActiveDocument === null) {
                            console.log("> socket: got 'request-edit', waiting for globalActiveDocument to not be null");
                        }
                        let text = globalActiveDocument.getText();
                        extensionSocket.emit("extension:edits", text);
                    });
                }
            }
        });
    });
}

function sendMessage() {
    console.log("> Called sendMessageCommand");
    if(extensionSocket === undefined) {
        console.log("> sendMessageCommand: No socket currently active, returning.");
        vscode.window.showErrorMessage(`SideWindow: No connection currently active.`, {modal: false});
        return;
    } else {
        if(!extensionSocket.connected) {
            console.log("> sendMessageCommand: Socket exists but is not connected");
            vscode.window.showErrorMessage(`SideWindow: No connection currently active.`, {modal: false});
            return;
        }
    }
    console.log("> sendMessageCommand: Now prompting user for input");

    const showInputBoxOptions = {
        ignoreFocusOut: true,
        password: false,
        placeHolder: "Hi! This is a message from the server.",
        prompt: "Message to send to clients",
        value: undefined,
        valueSelection: undefined
    };
    const messageInput = vscode.window.showInputBox(showInputBoxOptions);
    messageInput.then(
        (message) => {
            console.log(`> sendMessageCommand: user input '${message}'`);
            extensionSocket.emit("extension:msg", message);
            vscode.window.showInformationMessage(`SideWindow: Sent message '${message}' to connected clients`);
        }
    );
}

function shareFile() {
    console.log("> Called shareFileCommand");
    const activeTextEditor = vscode.window.activeTextEditor;
    if(extensionSocket === undefined) {
        console.log(`> shareFileCommand: No socket currently active. Returning.`);
        vscode.window.showErrorMessage(`SideWindow: No connection currently active.`);
        return;
    }
    else if(activeTextEditor === undefined) {
        console.log(`> shareFileCommand: active text editor is undefined. Returning.`);
        vscode.window.showErrorMessage(`SideWindow: No active editor to share.`);
        return;
    }

    // access active document and filepath
    // if we previously had an active document, this should get changed to the current active document
    let activeDocument = activeTextEditor.document;
    // make the globalActiveDocument this
    globalActiveDocument = activeDocument;

    const filepath = activeTextEditor.document.uri.path;

    // TODO: update port status bar item

    console.log(`> shareFileCommand: will share ${filepath}`);

    let documentText = activeDocument.getText();
    console.log(`> shareFileCommand: document text is as follows:`);
    console.log(documentText);

    // broadcast current contents
    extensionSocket.emit("extension:edits", documentText);

    // set up event listener for when we make a change

    // basically, if the listener is not active, activate it and set up the listener
    // but if it's already 'active', i.e. we've gone through this process
    // then don't run this, which will set another listener
    console.log(`> checking if event listeners have been activated yet`);
    if(!areEventListenersActive) {
        console.log(`> event listeners not activated yet, attaching events, setting areEventListenersActive to true`);

        console.log(`> shareFileCommand: attaching onDidChangeTextDocument event`);

        // function changeListenerCallback is passed into the "onDidChangeTextDocument"
        function changeListenerCallback(changeEvent: vscode.TextDocumentChangeEvent) {
            // this event fires every time any document is changed, so we should check the document that got changed
            console.log(`> changeListenerCallback: Got 'onDidChangeTextDocument' event`);
            if(changeEvent.document === globalActiveDocument) {
                console.log(`> changeListenerCallback: changed document matches globalActiveDocument ${globalActiveDocument.uri.fsPath}.`);
                let text = globalActiveDocument.getText();
                extensionSocket.emit("extension:edits", text);
            }
            else {
                console.log(`> extension: changed document doesn't matches shared globalActiveDocument.`);
            }
        }

        globalChangeEventListener = vscode.workspace.onDidChangeTextDocument(changeListenerCallback);
        areEventListenersActive = true;

        // set up event listener for browser edits
        console.log(`> shareFileCommand: attaching browser:edits event`);
        extensionSocket.on("browser:edits", (msg) => {
            console.log(`> socket: [browser:edits]: ${msg}`);
            // there's probably a better way to do this, but...
            // need to access the properties of the document and its lines to get start and end positions
            // then apply an edit to that range which replaces the document with the new received text
            if(globalActiveDocument === null) {
                console.log(`> ERROR: globalActiveDocument currently NULL.`);
                return;
            }
            let lineCount = globalActiveDocument.lineCount;
            let firstLine = globalActiveDocument.lineAt(0);
            let lastLine = globalActiveDocument.lineAt(lineCount - 1);
            let firstLineRange = firstLine.range;
            let lastLineRange = lastLine.range;
            let deleteRange = firstLineRange.with(firstLineRange.start, lastLineRange.end);
            // need to re-do activetexteditor if closed

            // if our globalActiveDocument has changed (i.e. we called share on another file, need to preseve the current 'globalActiveDocument' somehow
            const currentGlobalActiveDocument = globalActiveDocument;

            // make globalActiveDocument NULL until we finish applying the edit
            // this is so that the applied changes don't trigger the 'onDidGetDocumentChange' event
            globalActiveDocument = null;

            // instantiate and apply edit
            let newEdit = new vscode.WorkspaceEdit();
            newEdit.replace(currentGlobalActiveDocument.uri, deleteRange, msg);
            // after applying edit (in the 'then' callback, reinstate globalActiveDocument)
            vscode.workspace.applyEdit(newEdit).then( () => {
                console.log("> edit applied, reinstating global active doc");
                // reinstate globalActiveDocument
                globalActiveDocument = currentGlobalActiveDocument;
            });
        });
    } 
    else {
        console.log(`areEventListenersActive is ${areEventListenersActive} so we're not attaching the event listeners again`);
    }
}

function disconnect() {
    console.log(`> Called disconnectCommand`);

    if(extensionSocket === undefined) {
        console.log(`> disconnectCommand: No socket currently active. Returning.`);
        vscode.window.showErrorMessage(`SideWindow: No connection currently active.`, {modal: false});
        return;
    }

    // should destroy the event listeners
    console.log(`> disposing globalChangeEventListener`);
    globalChangeEventListener.dispose();

    console.log(`> disposing browser:edits listener`);
    extensionSocket.off('browser:edits');

    console.log(`> resetting areEventListenersActive to false`);
    areEventListenersActive = false;

    console.log(`> disconnectCommand: Now disconnecting socket...`);
    extensionSocket.disconnect();
    console.log(`> disconnectCommand: Socket disconnected.`);
    statusbar.disposeStatusBarItem();
    // extension_socket = undefined;
}

function showRoomCode() {
    console.log(`> Called showRoomCodeCommand`);
    if(roomId === undefined) {
        console.log(`> showRoomCommand: No socket currently active. Returning.`);
        vscode.window.showErrorMessage(`SideWindow: No connection currently active.`, {modal: false});
        return;
    } else {
        console.log(`> showRoomCodeCommand: showing room code ${roomId} to user.`);
        vscode.window.showInformationMessage(`SideWindow: Room code is ${roomId}`, {modal: false});
        return;
    }
}


export {connectAndShare, startConnection, sendMessage, shareFile, disconnect, showRoomCode};