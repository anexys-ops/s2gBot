const HTTP_MESSAGES: Record<number, string> = {
  400: 'Requête invalide.',
  401: 'Session expirée — reconnectez-vous.',
  403: 'Action non autorisée.',
  404: 'Élément introuvable.',
  409: 'Conflit — l’enregistrement a peut-être déjà été modifié.',
  422: 'Certaines informations sont manquantes ou incorrectes.',
  429: 'Trop de requêtes — réessayez dans un instant.',
  500: 'Erreur serveur — réessayez ou contactez le support.',
  502: 'Le serveur est momentanément indisponible (502).',
  503: 'Service temporairement indisponible.',
}

export function httpStatusMessage(status: number): string {
  return HTTP_MESSAGES[status] ?? `Erreur ${status}`
}

export function requiredFieldMessage(label: string): string {
  return `Le champ « ${label} » est obligatoire.`
}

export function invalidFieldMessage(label: string): string {
  return `Le champ « ${label} » est invalide.`
}
