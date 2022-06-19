# Simple-Imap-Copy

Copies all contents of one IMAP account into another IMAP account.

-   It copies all folders and emails with the corresponding flags
-   It does not check if the email is already present on the target server, it will just create a new copy of it
-   It is not meant to backup you emails, just to migrate them to a new account (For backups use something like [OfflineIMAP](http://www.offlineimap.org))

## Dependencies

[Node.js](https://nodejs.org/en/) (Most modern versions should work)

## Installation

```Bash
git clone https://github.com/SebiTimeWaster/Simple-Imap-Copy.git
cd Simple-Imap-Copy
npm install
```

## Usage

In the file `Simple-Imap-Copy.js` you need to configure your IMAP accounts, then run:

```Bash
node Simple-Imap-Copy.js
```

Remember to subscribe to all copied folders on your target IMAP account, otherwise you won't see them in your email program.

## Problems

If you want to open an issue please set "debug" to true in the file `Simple-Imap-Copy.js` and include the complete console output in your issue (Remove personal information!).

## Changelog

Changelog v0.1:

-   Initial checkin
