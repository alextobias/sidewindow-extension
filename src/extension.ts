// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// importing io module from socketio client
import { io, Socket } from 'socket.io-client'

let extension_socket: Socket;
let room_id: String
// let main_socket: undefined | Socket;

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
		console.log("> startConnectionCommand: Now prompting user for input")

		const showInputBoxOptions = {
			ignoreFocusOut: true,
			password: false,
			placeHolder: "https://sidewindow.herokuapp.com",
			value: "https://sidewindow.herokuapp.com",
			prompt: "server to connect to",
			valueSelection: undefined
		}
		const connectionAddrInput = vscode.window.showInputBox(showInputBoxOptions);
		connectionAddrInput.then((connectionAddr) => {
			// determine what to do with input
			// again, this will not be available in production
			if(connectionAddr == undefined) {
				console.log("> startConnectionCommand: input box was closed.");
				return;
			}
			else if(connectionAddr == "") {
				console.log("> startConnectionCommand: empty connectionAddr. Returning.");
				return;
			}
			else {
				console.log(`> startConnectionCommand: attempting to connect to ${connectionAddr}`)

				const client_soc_options = {
					reconnection: true,
					reconnectionDelay: 1000,
					reconnectionDelayMax: 5000,
					timeout: 20000,
					query: {
						type: "extension",
					}
				}
	
				extension_socket = io(connectionAddr, client_soc_options);
				// main_socket = extension_socket;

				if(extension_socket === undefined) {
					console.log(`> startConnectionCommand: ERROR - connection failed mysteriously!`)
					return
				} 
				else {

					console.log(`> startConnectionCommand: DEBUG - code is reached`);
					// get room code from extension

					extension_socket.on("connect", () => {
						console.log(`> socket: connected to server at ${connectionAddr})`);
						console.log(`> socket: this socket id is ${extension_socket.id}`)
						room_id = extension_socket.id.slice(0, 4)
						console.log(`> startConnectionCommand: room_id is ${room_id}`);
						console.log(`> socket: connected to room ${room_id}`);
						vscode.window.showInformationMessage(`sidewindow: Connected to room ${room_id}`, {modal: false});

						// TODO: update status bar item
					})

					extension_socket.on("disconnect", (msg) => {
						console.log(`> socket: disconnect event received! We've been disconnected`);
						console.log(`> socket: disconnect message is ${msg}`);
						vscode.window.showInformationMessage(`sidewindow: Disconnected.`, {modal: false});
						extension_socket.disconnect()
					})

					extension_socket.onAny((ev, arg) => {
						console.log(`> socket: received event ${ev} with args ${arg}`);
					})

					// the "source:event" format will be used in the future
					extension_socket.on("browser:msg", (msg) => {
						console.log(`> socket: received message '${msg} from a browser`);
						vscode.window.showInformationMessage(`Received message: ${msg}`);
					})

					// for now, we are keeping the "source-event" format for compatibility
					extension_socket.on("server-msg", (msg) => {
						console.log(`> socket: received message '${msg} from server`);
					})

				}
			}
		})
	})

	let sendMessageCommand = vscode.commands.registerCommand('sidewindow.sendMessage', () => {
		console.log("> Called sendMessageCommand");
		if(extension_socket === undefined) {
			console.log("> sendMessageCommand: No socket currently active, returning.")
			vscode.window.showErrorMessage(`sidewindow: No socket currently active.`, {modal: false});
			return
		}

		console.log("> sendMessageCommand: Now prompting user for input")

		const showInputBoxOptions = {
			ignoreFocusOut: true,
			password: false,
			placeHolder: "Hi! This is a message from the server.",
			prompt: "Message to send to clients",
			value: undefined,
			valueSelection: undefined
		}
		const messageInput = vscode.window.showInputBox(showInputBoxOptions);
		messageInput.then(
			(message) => {
				console.log(`> sendMessageCommand: user input '${message}'`);
				extension_socket.emit("extension:msg", message);
				vscode.window.showInformationMessage(`sidewindow: Sent message '${message}' to connected clients`);
			}
		);
	})

	let shareFileCommand = vscode.commands.registerCommand('sidewindow.shareFile', function() {
		console.log("> Called shareFileCommand");
		const activeTextEditor = vscode.window.activeTextEditor;
		if(extension_socket === undefined) {
			console.log(`> shareFileCommand: No socket currently active. Returning.`);
			return
		}
		else if(activeTextEditor === undefined) {
			console.log(`> shareFileCommand: active text editor is undefined. Returning.`);
			vscode.window.showErrorMessage(`sidewindow: No active editor to share.`)
			return
		}
		// access active document and filepath
		const activeDocument = activeTextEditor.document;
		const filepath = activeTextEditor.document.uri.path;

		// TODO: update port status bar item

		console.log(`> shareFileCommand: will share ${filepath}`);

		let documentText = activeDocument.getText();
		console.log(`> shareFileCommand: document text is as follows:`);
		console.log(documentText);

		extension_socket.emit("extension:edits", documentText);

		console.log(`> shareFileCommand: attaching onDidChangeTextDocument event`);
		vscode.workspace.onDidChangeTextDocument( changeEvent => {
			console.log(`> extension: Got 'onDidChangeTextDocument' event`);
			let text = activeDocument.getText();
			extension_socket.emit("extension:edits", text);
		});

		// set up event listener for browser edits
		console.log(`> shareFileCommand: attaching browser:edits event`);
		extension_socket.on("browser:edits", (msg) => {
			console.log(`> socket: got [browser:edits] event aka new content from a browser client`);
			// there's probably a better way to do this, but...
			// need to access the properties of the document and its lines to get start and end positions
			// then apply an edit to that range which replaces the document with the new received text
			let lineCount = activeDocument.lineCount
			// console.log("Document linecount: " + lineCount)
			let firstLine = activeDocument.lineAt(0)
			let lastLine = activeDocument.lineAt(lineCount - 1)
			// console.log("Document first line:" + firstLine.text)
			// console.log("Document last line:" + lastLine.text)
			let firstLineRange = firstLine.range
			let lastLineRange = lastLine.range
			// console.log("First line range: " + firstLineRange.start + " to " + firstLineRange.end)
			// console.log("Last line range: " + lastLineRange.start + " to " + lastLineRange.end)
			let deleteRange = firstLineRange.with(firstLineRange.start, lastLineRange.end)
			// console.log("Delete range: " + deleteRange.start + " to " + deleteRange.end)
			activeTextEditor.edit(editBuilder => {
				editBuilder.delete(deleteRange)
				editBuilder.insert(firstLineRange.start, msg)
				// editBuilder deletes only work with ranges or selections
				// so I have to give it the whole range of the document
				// get document linecount
				// let deleteRange = new Range(0,0, docum)
				// editBuilder.delete()
			})
		})
	})

	let disconnectCommand = vscode.commands.registerCommand('sidewindow.disconnect', () => {
		console.log(`> Called disconnectCommand`);
		if(extension_socket === undefined) {
			console.log(`> disconnectCommand: No socket currently active. Returning.`);
			vscode.window.showErrorMessage(`sidewindow: No socket currently active.`, {modal: false});
			return
		}
		console.log(`> disconnectCommand: Now disconnecting socket...`);
		extension_socket.disconnect()
		console.log(`> disconnectCommand: Socket disconnected.`);
		// extension_socket = undefined;
	});

	let showRoomCodeCommand = vscode.commands.registerCommand('sidewindow.showRoomCode', () => {
		console.log(`> Called showRoomCodeCommand`);
		if(room_id === undefined) {
			console.log(`> showRoomCommand: No socket currently active. Returning.`);
			vscode.window.showErrorMessage(`sidewindow: No socket currently active.`, {modal: false});
			return
		} else {
			console.log(`> showRoomCodeCommand: showing room code ${room_id} to user.`);
			vscode.window.showInformationMessage(`sidewindow: Room code is ${room_id}`, {modal: false});
			return
		}
	})
			

	context.subscriptions.push(disposable);
	context.subscriptions.push(startConnectionCommand);
	context.subscriptions.push(sendMessageCommand);
	context.subscriptions.push(shareFileCommand);
	context.subscriptions.push(disconnectCommand);
	context.subscriptions.push(showRoomCodeCommand);

}

// this method is called when your extension is deactivated
export function deactivate() {}
