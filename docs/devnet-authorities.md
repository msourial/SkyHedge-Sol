# Devnet authority configuration

This is a public-key-only record. It contains no recovery phrases, private keys, API tokens, or database credentials.

| Role | Public key | Responsibility |
| --- | --- | --- |
| Protocol admin | `DKA9RkGvaW4isyj5xdiZ2oGVUkD1UL64Ha1BazXZFD6y` | Must sign protocol initialization and any two-step authority changes. |
| Settlement service | `AVe5ULAoAyDaXAPS7s2sAUJo7A2QmDuph9Nwyrm9v5Vh` | Submits one NOAA-normalized final observation per market. |
| Program | `5hGLEG1ts46iER4pfWnP1fMb8sG5nxSinNY1pjYnNPWx` | Prepared Devnet program identity; it is not deployed yet. |

The settlement private key is stored locally in an ignored file. It must be rotated before any use beyond this Devnet build, and never committed or pasted into chat.

The admin address is a wallet public key, not a deployer keypair. Therefore the owner must approve the initialization transaction through that wallet after the program and SKYT mint exist.
