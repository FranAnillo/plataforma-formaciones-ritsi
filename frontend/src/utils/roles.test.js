import { roleNames } from './roles';

describe('roleNames', () => {
  it('contains the labels for every supported dashboard role', () => {
    expect(roleNames).toEqual(
      expect.objectContaining({
        admin: 'Administrador',
        escuela_formacion: 'Escuela de Formación',
        colaboracion_externa: 'Colaboración Externa',
        coordinador_tematico: 'Vocalía',
        junta_directiva: 'Junta Directiva',
        universidad: 'Universidad',
        representante: 'Representante',
        formador: 'Persona Formadora',
      })
    );
  });
});
