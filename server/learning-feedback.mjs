export function learningFailure(code, currentTake) {
  const messages = {
    1: 'El motor no ha validado las tomas. Empezamos de nuevo desde la primera.',
    4: 'La toma es demasiado corta. Repite la frase completa.',
    5: 'La placa ha recibido audio no valido. Repite esta toma.',
    6: 'La frase entra en conflicto con un comando del modelo. Prueba otra frase.'
  };
  return {
    message: (messages[code] ?? 'La placa ha rechazado la toma.') + ` (Codigo ${code})`,
    take: code === 1 || code === 6 ? 1 : currentTake
  };
}
