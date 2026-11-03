import bcrypt from 'bcryptjs';

const palavraPasse = process.argv[2];
if (!palavraPasse) {
  console.error('Uso: node gerar-hash.js <palavra-passe>');
  process.exit(1);
}
console.log(bcrypt.hashSync(palavraPasse, 10));
