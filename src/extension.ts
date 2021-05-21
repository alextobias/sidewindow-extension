// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// importing io module from socketio client
import { io, Socket } from 'socket.io-client';
import { glob } from 'glob';

let statusBarItem: vscode.StatusBarItem;

let extensionSocket: Socket;
let roomId: string;

let globalLockIsHeld: boolean;

// let activeDocument: vscode.TextDocument;
// let globalActiveDocument: vscode.TextDocument;
let globalActiveDocument: vscode.TextDocument | null;
let globalChangeEventListener: vscode.Disposable;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "sidewindow" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('sidewindow.helloWorld', () => {
		// The code you place here will be executed every time your command is executed

		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from SideWindow!');
	});

	let startConnectionCommand = vscode.commands.registerCommand('sidewindow.startConnection', () => {
		console.log("> Called startConnectionCommand");
		// this will be taken away in production, since we will only be connecting to my server

		// some complicated logic here:
		// if the socket is undefined, that means we've never connected before, so it's valid to form a new connection
		// if the socket is already defined, we have to check if it is connected or not, using the socket.connected property
		if(extensionSocket !== undefined) {
			// if we're here, that means the socket exists and has at some point been connected
			// check if it is currently connected
			// my thinking: if it's been connected before, then roomId should be defined
			console.log(`> startConnectionCommand: socket is already active.`);
			if(roomId === undefined) {
				console.log(`> startConnectionCommand: socket is/has existed but roomId is undefined!`);
			} else {
				console.log(`> startConnectionCommand: socket is/has existed and roomId is ${roomId}`);
			}

			if(extensionSocket.connected) {
				console.log(`> startConnectionCommand: socket is active and is currently connected.`);
				vscode.window.showInformationMessage("sidewindow: You are already connected.");
				return;
			}
			else {
				// in this case, it is not connected
				// so we can go ahead and redo the connection, and assign extensionSocket to it
				console.log(`> startConnectionCommand: socket exists but is not currently connected.`);
				// so we can continue
			}
		}

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

					extensionSocket.on("connect", () => {
						console.log(`> socket: connected to server at ${connectionAddr})`);
						console.log(`> socket: this socket id is ${extensionSocket.id}`);
						roomId = extensionSocket.id.slice(0, 4);
						console.log(`> startConnectionCommand: room_id is ${roomId}`);
						console.log(`> socket: connected to room ${roomId}`);
						vscode.window.showInformationMessage(`sidewindow: Connected to room ${roomId}`, {modal: false});

						// TODO: update status bar item
						initializeStatusBarItem(roomId);
					});

					extensionSocket.on("disconnect", (msg) => {
						console.log(`> socket: disconnect event received! We've been disconnected`);
						console.log(`> socket: disconnect message is ${msg}`);
						vscode.window.showInformationMessage(`sidewindow: Disconnected.`, {modal: false});
						extensionSocket.disconnect();

						// disposeStatusBarItem();
						changeStatusBarItem("disconnected");
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

	let sendMessageCommand = vscode.commands.registerCommand('sidewindow.sendMessage', () => {
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
	});

	let shareFileCommand = vscode.commands.registerCommand('sidewindow.shareFile', function() {
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
	});

	let disconnectCommand = vscode.commands.registerCommand('sidewindow.disconnect', () => {
		console.log(`> Called disconnectCommand`);
		if(extensionSocket === undefined) {
			console.log(`> disconnectCommand: No socket currently active. Returning.`);
			vscode.window.showErrorMessage(`sidewindow: No connection currently active.`, {modal: false});
			return;
		}
		console.log(`> disconnectCommand: Now disconnecting socket...`);
		extensionSocket.disconnect();
		console.log(`> disconnectCommand: Socket disconnected.`);
		disposeStatusBarItem();
		// extension_socket = undefined;
	});

	let showRoomCodeCommand = vscode.commands.registerCommand('sidewindow.showRoomCode', () => {
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
	});

	context.subscriptions.push(disposable);
	context.subscriptions.push(startConnectionCommand);
	context.subscriptions.push(sendMessageCommand);
	context.subscriptions.push(shareFileCommand);
	context.subscriptions.push(disconnectCommand);
	context.subscriptions.push(showRoomCodeCommand);

}

function initializeStatusBarItem(message: string) {
	console.log(`> statusBarItem: initializing with text ${message}`);
	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	statusBarItem.text = `sidewindow: ${message}`;
	statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
	statusBarItem.color = vscode.ThemeColor;
	statusBarItem.show();
}

function changeStatusBarItem(message: string) {
	console.log(`> statusBarItem: changing message to ${message}`);
	statusBarItem.text = `sidewindow: ${message}`;
	statusBarItem.show();
}

function disposeStatusBarItem() {
	console.log(`> statusBarItem: disposing.`);
	statusBarItem.dispose();
}

// this method is called when your extension is deactivated
export function deactivate() {}
