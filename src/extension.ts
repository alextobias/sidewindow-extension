// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import * as connection from './connection';

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

	let connectAndShareCommand = vscode.commands.registerCommand('sidewindow.connectAndShare', connection.connectAndShare);

	let startConnectionCommand = vscode.commands.registerCommand('sidewindow.startConnection', connection.startConnection);

	let sendMessageCommand = vscode.commands.registerCommand('sidewindow.sendMessage', connection.sendMessage);

	let shareFileCommand = vscode.commands.registerCommand('sidewindow.shareFile', connection.shareFile);

	let disconnectCommand = vscode.commands.registerCommand('sidewindow.disconnect', connection.disconnect);

	let showRoomCodeCommand = vscode.commands.registerCommand('sidewindow.showRoomCode', connection.showRoomCode);

	let openClientInBrowserCommand = vscode.commands.registerCommand('sidewindow.openClientInBrowser', () => {
		let clientLink = vscode.Uri.parse("https://sidewindow.herokuapp.com");
		vscode.env.openExternal(clientLink);
	});


	context.subscriptions.push(disposable);
	context.subscriptions.push(openClientInBrowserCommand);
	context.subscriptions.push(connectAndShareCommand);
	context.subscriptions.push(startConnectionCommand);
	context.subscriptions.push(sendMessageCommand);
	context.subscriptions.push(shareFileCommand);
	context.subscriptions.push(disconnectCommand);
	context.subscriptions.push(showRoomCodeCommand);

}
// this method is called when your extension is deactivated
export function deactivate() {}
