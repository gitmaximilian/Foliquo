# Local browser delivery

The current product is a single-user browser application whose processing service runs on the same computer. It does not use public hosting, shared accounts, or a multi-user cloud backend. The UI is accessed in the user's ordinary browser through `127.0.0.1` while the local service is running.

A remotely hosted multi-user service would require a separate architecture for authentication, tenant isolation, encrypted document storage, deletion, provider credentials, and data-retention controls. It is outside the current release scope.
