// importing vscode api
import * as vscode from 'vscode';
// importing io module from socketio client
import { io, Socket } from 'socket.io-client';
let roomId: string;
let globalActiveDocument: vscode.TextDocument | null;
let globalChangeEventListener: vscode.Disposable;
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
                vscode.window.showInformationMessage("sidewindow: You are already connected.");
                reject("already connected!");
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

        connectionAddrInput.then((connectionAddr) => {
            // determine what to do with input
            // again, this will not be available in production
            if(connectionAddr === undefined) {
                console.log("> startConnectionCommand: input box was closed.");
                return;
            }
            else if(connectionAddr === "") {
                console.log("> startConnectionCommand: empty connectionAddr. Returning.");
                return;
            }
            else {
                console.log(`> startConnectionCommand: attempting to connect to ${connectionAddr}`);

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
                        vscode.window.showErrorMessage("sidewindow: Error connecting to server.");
                        extensionSocket.disconnect();
                    });

                    extensionSocket.on("connect", () => {
                        console.log(`> socket: connected to server at ${connectionAddr})`);
                        console.log(`> socket: this socket id is ${extensionSocket.id}`);
                        roomId = extensionSocket.id.slice(0, 4);
                        console.log(`> startConnectionCommand: room_id is ${roomId}`);
                        console.log(`> socket: connected to room ${roomId}`);
                        vscode.window.showInformationMessage(`sidewindow: Connected to room ${roomId}`, {modal: false});

                        // TODO: update status bar item
                        statusbar.initializeStatusBarItem(roomId);
                        resolve("RESOLVE - connection ready!");
                    });

                    extensionSocket.on("disconnect", (msg) => {
                        console.log(`> socket: disconnect event received! We've been disconnected`);
                        console.log(`> socket: disconnect message is ${msg}`);
                        vscode.window.showInformationMessage(`sidewindow: Disconnected.`, {modal: false});
                        extensionSocket.disconnect();

                        // disposeStatusBarItem();
                        statusbar.changeStatusBarItem("disconnected");
                    });

                    // extensionSocket.onAny((ev, arg) => {
                    // 	console.log(`> socket: [GENERAL] received event ${ev} with args ${arg}`);
                    // });

                    // the "source:event" format will be used in the future
                    extensionSocket.on("browser:msg", (msg) => {
                        console.log(`> socket: received message '${msg} from a browser`);
                        vscode.window.showInformationMessage(`Received message: ${msg}`);
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
        vscode.window.showErrorMessage(`sidewindow: No connection currently active.`, {modal: false});
        return;
    } else {
        if(!extensionSocket.connected) {
            console.log("> sendMessageCommand: Socket exists but is not connected");
            vscode.window.showErrorMessage(`sidewindow: No connection currently active.`, {modal: false});
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
            vscode.window.showInformationMessage(`sidewindow: Sent message '${message}' to connected clients`);
        }
    );
}

function shareFile() {
    console.log("> Called shareFileCommand");
    const activeTextEditor = vscode.window.activeTextEditor;
    if(extensionSocket === undefined) {
        console.log(`> shareFileCommand: No socket currently active. Returning.`);
        vscode.window.showErrorMessage(`sidewindow: No connection currently active.`);
        return;
    }
    else if(activeTextEditor === undefined) {
        console.log(`> shareFileCommand: active text editor is undefined. Returning.`);
        vscode.window.showErrorMessage(`sidewindow: No active editor to share.`);
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

    console.log(`> shareFileCommand: attaching onDidChangeTextDocument event`);

    globalChangeEventListener = vscode.workspace.onDidChangeTextDocument(changeListenerCallback);

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
        // console.log("Document linecount: " + lineCount)
        let firstLine = globalActiveDocument.lineAt(0);
        let lastLine = globalActiveDocument.lineAt(lineCount - 1);
        // console.log("Document first line:" + firstLine.text)
        // console.log("Document last line:" + lastLine.text)
        let firstLineRange = firstLine.range;
        let lastLineRange = lastLine.range;
        // console.log("First line range: " + firstLineRange.start + " to " + firstLineRange.end)
        // console.log("Last line range: " + lastLineRange.start + " to " + lastLineRange.end)
        let deleteRange = firstLineRange.with(firstLineRange.start, lastLineRange.end);
        // console.log("Delete range: " + deleteRange.start + " to " + deleteRange.end)
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

function disconnect() {
    console.log(`> Called disconnectCommand`);
    if(extensionSocket === undefined) {
        console.log(`> disconnectCommand: No socket currently active. Returning.`);
        vscode.window.showErrorMessage(`sidewindow: No connection currently active.`, {modal: false});
        return;
    }
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
        vscode.window.showErrorMessage(`sidewindow: No connection currently active.`, {modal: false});
        return;
    } else {
        console.log(`> showRoomCodeCommand: showing room code ${roomId} to user.`);
        vscode.window.showInformationMessage(`sidewindow: Room code is ${roomId}`, {modal: false});
        return;
    }
}


export {connectAndShare, startConnection, sendMessage, shareFile, disconnect, showRoomCode};