import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { TestTypeFormField } from '../../api/client'
import TestFormFieldsEditor, { validateFormFields } from './TestFormFieldsEditor'

function Editor() {
  const [fields, setFields] = useState<TestTypeFormField[]>([])
  return <MemoryRouter><TestFormFieldsEditor fields={fields} onChange={setFields} lists={[]} /><output data-testid="fields">{JSON.stringify(fields)}</output></MemoryRouter>
}

describe('éditeur de formulaire d’essai', () => {
  it('signale les champs incomplets au lieu de les écarter à l’enregistrement', () => {
    expect(validateFormFields([])).toContain('Ajoutez au moins un champ au formulaire.')
    expect(validateFormFields([{ key: '', label: 'Mesure', type: 'number', required: false }])).toContain(
      'Champ 1 : la clé doit commencer par une lettre et contenir uniquement lettres, chiffres, _ ou -.',
    )
  })

  it('conserve les séparateurs pendant la saisie des choix multiples', () => {
    render(<Editor />)
    fireEvent.change(screen.getByLabelText('Type de champ à ajouter'), { target: { value: 'select' } })
    fireEvent.click(screen.getByRole('button', { name: /Ajouter un champ/ }))
    fireEvent.change(screen.getByLabelText('Nom affiché *'), { target: { value: 'État' } })
    const input = screen.getByLabelText('Choix, séparés par « ; »') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Oui;' } })
    expect(input.value).toBe('Oui;')
    fireEvent.change(input, { target: { value: 'Oui; Non' } })
    expect(input.value).toBe('Oui; Non')
    expect(JSON.parse(screen.getByTestId('fields').textContent || '[]')[0].options).toEqual(['Oui', 'Non'])
  })
})
