import React from 'react';
import { useForm } from 'react-hook-form';
import { UserRole, createUserSchema, updateUserSchema } from '@scienpay/shared';
import { useCreateUser, useUpdateUser } from '../../hooks/useUsers.js';
import { useToast } from '../../context/ToastContext.js';
import { getApiErrorMessage } from '../../lib/apiClient.js';
import { zodResolver } from '../../lib/zodResolver.js';
import { Button, FormActions, FormField, SelectInput, TextInput } from '../ui/FormControls.js';
import type { UserAccount } from '../../types/api.types.js';

interface UserFormProps {
  onSuccess: () => void;
  user?: UserAccount;
}

interface UserFormValues {
  email: string;
  fullName: string;
  title?: string;
  role: UserRole;
  password?: string;
}

export const UserForm: React.FC<UserFormProps> = ({ onSuccess, user }) => {
  const { showToast } = useToast();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const isEdit = Boolean(user);

  const form = useForm<UserFormValues>({
    resolver: zodResolver<UserFormValues>(isEdit ? updateUserSchema : createUserSchema),
    defaultValues: isEdit
      ? {
          email: user!.email,
          fullName: user!.fullName,
          title: user!.title,
          role: user!.role,
        }
      : {
          email: '',
          fullName: '',
          title: '',
          role: UserRole.GENERADOR,
          password: '',
        },
  });

  const errors = form.formState.errors;
  const isPending = createUser.isPending || updateUser.isPending;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (isEdit) {
        await updateUser.mutateAsync({
          id: user!.id,
          input: {
            email: values.email,
            fullName: values.fullName,
            title: values.title,
            role: values.role,
          },
        });
        showToast('Usuario actualizado correctamente', 'success');
      } else {
        await createUser.mutateAsync({
          email: values.email,
          fullName: values.fullName,
          title: values.title,
          role: values.role,
          password: values.password!,
        });
        showToast('Usuario creado correctamente', 'success');
      }
      onSuccess();
    } catch (error) {
      showToast(getApiErrorMessage(error), 'error');
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormField label="Correo institucional" required error={errors.email?.message}>
        <TextInput
          type="email"
          placeholder="usuario@scienpay.uc.edu.ve"
          hasError={Boolean(errors.email)}
          {...form.register('email')}
        />
      </FormField>

      <FormField label="Nombre completo" required error={errors.fullName?.message}>
        <TextInput hasError={Boolean(errors.fullName)} {...form.register('fullName')} />
      </FormField>

      <FormField label="Cargo" error={errors.title?.message}>
        <TextInput
          placeholder="Coordinador General"
          hasError={Boolean(errors.title)}
          {...form.register('title')}
        />
      </FormField>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Rol" required error={errors.role?.message}>
          <SelectInput hasError={Boolean(errors.role)} {...form.register('role')}>
            {Object.values(UserRole).map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </SelectInput>
        </FormField>

        {!isEdit && (
          <FormField
            label="Contraseña inicial"
            required
            error={errors.password?.message}
            hint="Mínimo 12 caracteres"
          >
            <TextInput
              type="password"
              hasError={Boolean(errors.password)}
              {...form.register('password')}
            />
          </FormField>
        )}
      </div>

      {!isEdit && (
        <p className="text-[10px] text-[#9B9A97] dark:text-[#888886]">
          El nombre de usuario se deriva automáticamente de la parte local del correo.
        </p>
      )}

      <FormActions>
        <Button type="button" variant="secondary" onClick={onSuccess}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Guardando…' : isEdit ? 'Guardar Cambios' : 'Crear Usuario'}
        </Button>
      </FormActions>
    </form>
  );
};
