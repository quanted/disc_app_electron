# disc_app_electron
Electron app for Decision Integration for Strong Communities (DISC) tool
## Django app and source file setup
**Note**: Running this requires [Git](https://git-scm.com/), [Python 3](https://www.python.org/downloads/), and [Django](https://www.djangoproject.com/download/) on your system.
### Clone the qed_hwbi host project
`git clone -b dev --recursive https://github.com/quanted/qed_hwbi.git`
### Switch to the dev branches of hwbi_app, static_qed, and templates_qed
`cd hwbi_app`  
`git checkout dev`
### You will need to obtain hwbi_db.sqlite3 from *somewhere* and put it in hwbi_app
## Electron App Compilation from Source
**Note**: Running this requires [Git](https://git-scm.com/) and [Node.js](https://nodejs.org/en/) (which includes npm) on your system.
### Clone the repository to the qed_hwbi folder
`$ git clone -b dev https://github.com/quanted/disc_app_electron.git`
### Run the python script to create index.html for the electron app from the qed_hwbi folder
`python manage.py shell`  
`exec(open('disc_app_electron/create_electron_html.py').read())`
### Go into the repository
`$ cd disc_app_electron`
### Install dependencies
`$ npm install`
### Run the app
`$ npm start`