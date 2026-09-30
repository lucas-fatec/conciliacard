const { validarCredenciais } = require('../src/auth');

describe('CT-UC01 - Validacao de credenciais', () => {
  test('CT-UC01-01 aceita e-mail e senha validos', () => {
    expect(validarCredenciais('usuario@fatec.sp.gov.br', 'Senha@2026')).toEqual([]);
  });

  test('CT-UC01-02 rejeita e-mail em formato invalido', () => {
    const erros = validarCredenciais('usuario.fatec.com', 'Senha@2026');
    expect(erros).toContain('E-mail invalido.');
  });

  test('CT-UC01-03 rejeita senha sem caractere especial', () => {
    const erros = validarCredenciais('usuario@fatec.sp.gov.br', 'Senha2026');
    expect(erros.join(' ')).toMatch(/no minimo 8 caracteres/);
  });

  test('CT-UC01-04 rejeita senha curta', () => {
    const erros = validarCredenciais('usuario@fatec.sp.gov.br', 'Se@1');
    expect(erros).toHaveLength(1);
  });

  test('CT-UC01-05 rejeita campos vazios', () => {
    expect(validarCredenciais('', '')).toHaveLength(2);
  });
});
