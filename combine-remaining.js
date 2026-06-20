import { readFileSync, writeFileSync } from 'fs';

let remainingSql = '';

for (let i = 2; i <= 30; i++) {
  const content = readFileSync(`migration_part_${i}.sql`, 'utf8');
  remainingSql += content + '\n\n';
}

writeFileSync('remaining_migrations.sql', remainingSql, 'utf8');
console.log('✅ Combined migration parts 2 to 30 into remaining_migrations.sql');
