const { electron, Menu, app } = require('electron');
const ElectronPreferences = require('electron-preferences');
const path = require('path');

const preferences = new ElectronPreferences({
	// Override default preference BrowserWindow values
	browserWindowOverrides: { /* ... */ },

	// Provide a custom CSS file, relative to your appPath.
	// css: 'preference-styles.css',

	// Preference file path
	dataStore: path.resolve(app.getPath('userData'), 'preferences.json'),

	// Preference default values
	defaults: {
		cotoha: {
			domain: '',
			email: '',
			password: '',
			shortcut_key: 'C'
		},
	},

	// Preference sections visible to the UI
	sections: [
		{
			id: 'cotoha',
			label: 'Cotoha',
			icon: 'single-01', // See the list of available icons below
			form: {
				groups: [
					{
						'label': 'Cotoha',
						'fields': [
							{
								label: 'Domain',
								key: 'domain',
								type: 'text',
								help: 'COTOHA domain (~.miraitranslator.com)'
							},
							{
								label: 'Mail',
								key: 'email',
								type: 'text',
								help: 'account mail address'
							},
							{
								label: 'Password',
								key: 'password',
								type: 'secret',
								help: 'account password'
							},
						]
					},
					{
						'label': 'App',
						'fields': [
							{
								label: 'Shortcut Key',
								key: 'shortcut_key',
								type: 'text',
								help: 'Translate shortcut key. (Ctrl+C, {value})'
							}
						]
					}
				]
			}
		},
	]
})


// Subscribing to preference changes.
preferences.on('save', (preferences) => {
	console.log(`Preferences were saved.`);
});


module.exports = preferences;