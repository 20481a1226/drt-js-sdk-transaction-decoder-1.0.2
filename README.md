# Transaction Decoder for JavaScript

Transaction processor for JavaScript and TypeScript (written in TypeScript).

## Distribution

[npm](https://www.npmjs.com/package/@terradharitri/transaction-decoder)

## Usage

```js
const metadata = new TransactionDecoder().getTransactionMetadata({
  sender: 'drt18w6yj09l9jwlpj5cjqq9eccfgulkympv7d4rj6vq4u49j8fpwzws36f6y2',
  receiver: 'drt18w6yj09l9jwlpj5cjqq9eccfgulkympv7d4rj6vq4u49j8fpwzws36f6y2',
  data: 'RVNEVE5GVFRyYW5zZmVyQDRjNGI0ZDQ1NTgyZDYxNjE2MjM5MzEzMEAyZmI0ZTlAZTQwZjE2OTk3MTY1NWU2YmIwNGNAMDAwMDAwMDAwMDAwMDAwMDA1MDBkZjNiZWJlMWFmYTEwYzQwOTI1ZTgzM2MxNGE0NjBlMTBhODQ5ZjUwYTQ2OEA3Mzc3NjE3MDVmNmM2YjZkNjU3ODVmNzQ2ZjVmNjU2NzZjNjRAMGIzNzdmMjYxYzNjNzE5MUA=',
  value: '0',
});
```
