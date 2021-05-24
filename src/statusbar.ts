import * as vscode from 'vscode';
let statusBarItem: vscode.StatusBarItem;

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

export {initializeStatusBarItem, changeStatusBarItem, disposeStatusBarItem};
