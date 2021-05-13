// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// importing io module from socketio client
import { io } from 'socket.io-client'

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
	
				const extension_socket = io(connectionAddr, client_soc_options);

				extension_socket.on("connect", () => {
					console.log(`> socket: connected to server at ${connectionAddr})`);
					console.log(`> socket: this socket id is ${extension_socket.id}`)
				})

				extension_socket.onAny((ev, arg) => {
					console.log(`> socket: received event ${ev} with args ${arg}`);
				})

				// the "source:event" format will be used in the future
				extension_socket.on("server:msg", (msg) => {
					console.log(`> socket: received message '${msg} from server`);
				})

				// for now, we are keeping the "source-event" format for compatibility
				extension_socket.on("server-msg", (msg) => {
					console.log(`> socket: received message '${msg} from server`);
				})
			}
		})
	})

	let sendMessageCommand = vscode.commands.registerCommand('sidewindow.sendMessage', () => {
		console.log("> Called sendMessageCommand");
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
			(retstring) => {
				console.log(`> sendMessageCommand: user input '${retstring}'`);
				// io_server.emit("server-msg", retstring);
				// vscode.window.showInformationMessage(`Sent message '${retstring}' to connected clients`);
			}
		);
	})


		



	context.subscriptions.push(disposable);
	context.subscriptions.push(startConnectionCommand);

}

// this method is called when your extension is deactivated
export function deactivate() {}
