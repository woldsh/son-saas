'use client';
import { updateDocWithAudit, setDocWithAudit } from '@/utils/auditTrail';

import { useState, FormEvent, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, auth } from '../lib/firebase';
import { doc,  getDoc,  arrayUnion } from 'firebase/firestore';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../contexts/LanguageContext';
import {
  FiUser,
  FiMail,
  FiLock,
  FiCheckCircle,
  FiAlertCircle,
  FiChevronRight,
  FiShield,
  FiTarget,
  FiCommand,
  FiEye,
  FiEyeOff,
  FiRefreshCw
} from 'react-icons/fi';
import { Loader2 } from 'lucide-react';

interface RegisterUserProps {
  onSuccess?: () => void;
}

const DEFAULT_ACADEMIC_DEPTS = [
  { id: 'accounting_finance', label: 'ACCOUNTING AND FINANCE' },
  { id: 'agribusiness', label: 'Agribusiness' },
  { id: 'animal_science', label: 'Animal Science' },
  { id: 'computer_science', label: 'Computer Science' },
  { id: 'economics', label: 'Economics' },
  { id: 'general_forester', label: 'General Forester' },
  { id: 'horticulture', label: 'Horticulture' },
  { id: 'management', label: 'Management' },
  { id: 'natural_resource_management', label: 'Natural Resource' },
  { id: 'plant_science', label: 'Plant Science' },
  { id: 'peace_development', label: 'Peace and Dev' },
  { id: 'veterinary_science', label: 'Veterinary Science' },
  { id: 'common_course', label: 'Common Course' }
];

export default function RegisterUser({ onSuccess }: RegisterUserProps) {
  const { t } = useLanguage();
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [mainRole, setMainRole] = useState('');

  // Dynamic sub-selection states
  const [academicSelection, setAcademicSelection] = useState('');
  const [departmentSelection, setDepartmentSelection] = useState('');
  const [customDepartment, setCustomDepartment] = useState('');
  const [availableAcademicDepts, setAvailableAcademicDepts] = useState(DEFAULT_ACADEMIC_DEPTS);
  const [deptRoleSelection, setDeptRoleSelection] = useState('');

  const [procurementSelection, setProcurementSelection] = useState('');
  const [stockStoreType, setStockStoreType] = useState('');

  const [adminSelection, setAdminSelection] = useState('');
  const [customAdminDept, setCustomAdminDept] = useState('');
  const [availableAdminDepts, setAvailableAdminDepts] = useState<{ id: string, label: string }[]>([
    { id: 'hrm', label: 'HRM' },
    { id: 'finance', label: 'Finance' },
    { id: 'procurement_admin', label: 'Procurement Admin (ግዥ አስተዳደር)' },
    { id: 'resource_development', label: 'Resource Dev & Revenue (ሃብት ልማት)' },
    { id: 'building_renovation', label: 'Building Renovation (ህንጻ እድሳት)' },
    { id: 'library_service', label: 'Library Service' },
    { id: 'security', label: 'Security' },
    { id: 'registrar', label: 'Registrar' },
    { id: 'student_service', label: 'Student Service' }
  ]);
  const [studentServiceSelection, setStudentServiceSelection] = useState('');
  const [adminRoleSelection, setAdminRoleSelection] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  // Fetch Configurations (Admin & Academic)
  useEffect(() => {
    const fetchConfigurations = async () => {
      try {
        if (!db) return;

        // Fetch Admin Depts
        const adminDocRef = doc(db, 'settings', 'admin_configurations');
        const adminDocSnap = await getDoc(adminDocRef);
        if (adminDocSnap.exists()) {
          const data = adminDocSnap.data();
          if (data.departments && Array.isArray(data.departments)) {
            setAvailableAdminDepts(prev => {
              const newDepts = [...prev];
              data.departments.forEach((deptName: string) => {
                const id = deptName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
                if (!newDepts.find(d => d.id === id)) {
                  newDepts.push({ id, label: deptName });
                }
              });
              return newDepts;
            });
          }
        }

        // Fetch Academic Depts
        const academicDocRef = doc(db, 'settings', 'academic_configurations');
        const academicDocSnap = await getDoc(academicDocRef);
        if (academicDocSnap.exists()) {
          const data = academicDocSnap.data();
          if (data.departments && Array.isArray(data.departments)) {
            setAvailableAcademicDepts(prev => {
              const newDepts = [...prev];
              data.departments.forEach((deptName: string) => {
                const id = deptName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
                if (!newDepts.find(d => d.id === id)) {
                  newDepts.push({ id, label: deptName });
                }
              });
              return newDepts;
            });
          }
        }

      } catch (err) {
        console.error("Failed to fetch configurations", err);
      }
    };

    fetchConfigurations();
  }, []);

  // Reset sub-selections when main role changes
  useEffect(() => {
    setAcademicSelection('');
    setDepartmentSelection('');
    setCustomDepartment('');
    setDeptRoleSelection('');
    setProcurementSelection('');
    setStockStoreType('');
    setAdminSelection('');
    setCustomAdminDept('');
    setStudentServiceSelection('');
    setAdminRoleSelection('');
  }, [mainRole]);

  // Reset student service sub-selection when admin selection changes
  useEffect(() => {
    setStudentServiceSelection('');
    setCustomAdminDept('');
    setAdminRoleSelection('');
  }, [adminSelection]);

  // Derived Logic for Final Roles
  const getRoleData = () => {
    switch (mainRole) {
      case 'managing_director':
        return {
          mainRole: 'managing_director',
          userRole: 'managing_director_leader',
          subRole: 'executive'
        };
      case 'chief':
        return {
          mainRole: 'chief',
          userRole: 'chief',
          subRole: 'institution_head'
        };
      case 'academic_staff':
        if (academicSelection === 'academic_coordinator') {
          return {
            mainRole: 'academic_staff',
            userRole: 'academic_coordinator',
            subRole: 'academic_management'
          };
        } else if (academicSelection === 'department') {
          let rolePrefix = departmentSelection;

          if (departmentSelection === 'other' && customDepartment) {
            rolePrefix = customDepartment
              .toLowerCase()
              .trim()
              .replace(/[^a-z0-9]+/g, '_')
              .replace(/^_+|_+$/g, '');
          }

          if (rolePrefix) {
            let deptLabel = departmentSelection;
            if (departmentSelection === 'other') deptLabel = customDepartment;
            else {
              const found = availableAcademicDepts.find(d => d.id === departmentSelection);
              if (found) deptLabel = found.label;
            }

            if (deptRoleSelection === 'head') {
              return {
                mainRole: 'academic_staff',
                userRole: `${rolePrefix}_head`,
                subRole: 'department_head',
                department: deptLabel
              };
            }
            if (deptRoleSelection === 'teacher') {
              return {
                mainRole: 'academic_staff',
                userRole: `${rolePrefix}_teacher`,
                subRole: 'instructor',
                department: deptLabel
              };
            }
          }
        }
        break;
      case 'procurement_management':
        if (procurementSelection === 'team_leader') {
          return {
            mainRole: 'procurement_management',
            userRole: 'procurement_team_leader',
            subRole: 'procurement_supervisor'
          };
        } else if (procurementSelection === 'stock_clerk') {
          if (stockStoreType === 'fixed_assets') {
            return { mainRole: 'procurement_management', userRole: 'fixed_asset_stock_clerk', subRole: 'inventory_controller', stockType: 'fixed_assets' };
          } else if (stockStoreType === 'consumable_items') {
            return { mainRole: 'procurement_management', userRole: 'consumable_item_stock_clerk', subRole: 'inventory_controller', stockType: 'consumable_items' };
          }
        } else if (procurementSelection === 'store_keeper') {
          if (stockStoreType === 'fixed_assets') {
            return { mainRole: 'procurement_management', userRole: 'fixed_asset_store_keeper', subRole: 'store_management', storeType: 'fixed_assets' };
          } else if (stockStoreType === 'consumable_items') {
            return { mainRole: 'procurement_management', userRole: 'consumable_item_store_keeper', subRole: 'store_management', storeType: 'consumable_items' };
          }
        }
        break;
      case 'admin_staff':
        if (adminSelection === 'hrm') {
          if (adminRoleSelection === 'leader') return { mainRole: 'admin_staff', userRole: 'hrm_leader', subRole: 'human_resource_manager' };
          if (adminRoleSelection === 'employee') return { mainRole: 'admin_staff', userRole: 'hrm_employee', subRole: 'human_resource_staff' };
        } else if (adminSelection === 'finance') {
          if (adminRoleSelection === 'leader') return { mainRole: 'admin_staff', userRole: 'finance_leader', subRole: 'finance_manager' };
          if (adminRoleSelection === 'employee') return { mainRole: 'admin_staff', userRole: 'finance_employee', subRole: 'finance_staff' };
        } else if (adminSelection === 'procurement_admin') {
          if (adminRoleSelection === 'leader') return { mainRole: 'admin_staff', userRole: 'procurement_admin_leader', subRole: 'procurement_admin_manager' };
          if (adminRoleSelection === 'employee') return { mainRole: 'admin_staff', userRole: 'procurement_admin_employee', subRole: 'procurement_admin_staff' };
        } else if (adminSelection === 'resource_development') {
          if (adminRoleSelection === 'leader') return { mainRole: 'admin_staff', userRole: 'resource_development_leader', subRole: 'resource_development_manager' };
          if (adminRoleSelection === 'employee') return { mainRole: 'admin_staff', userRole: 'resource_development_employee', subRole: 'resource_development_staff' };
        } else if (adminSelection === 'building_renovation') {
          if (adminRoleSelection === 'leader') return { mainRole: 'admin_staff', userRole: 'building_renovation_leader', subRole: 'building_renovation_manager' };
          if (adminRoleSelection === 'employee') return { mainRole: 'admin_staff', userRole: 'building_renovation_employee', subRole: 'building_renovation_staff' };
        } else if (adminSelection === 'library_service') {
          if (adminRoleSelection === 'leader') return { mainRole: 'admin_staff', userRole: 'library_service_leader', subRole: 'library_service_manager' };
          if (adminRoleSelection === 'employee') return { mainRole: 'admin_staff', userRole: 'library_service_employee', subRole: 'library_service_staff' };
        } else if (adminSelection === 'security') {
          if (adminRoleSelection === 'leader') return { mainRole: 'admin_staff', userRole: 'security_leader', subRole: 'security_manager' };
          if (adminRoleSelection === 'employee') return { mainRole: 'admin_staff', userRole: 'security_employee', subRole: 'security_staff' };
        } else if (adminSelection === 'registrar') {
          if (adminRoleSelection === 'leader') return { mainRole: 'admin_staff', userRole: 'registrar_leader', subRole: 'registrar_manager' };
          if (adminRoleSelection === 'employee') return { mainRole: 'admin_staff', userRole: 'registrar_employee', subRole: 'registrar_staff' };
        } else if (adminSelection === 'student_service') {
          if (studentServiceSelection === 'overall') {
            return {
              mainRole: 'admin_staff',
              userRole: 'student_service_leader',
              subRole: 'student_service_manager'
            };
          }
          if (studentServiceSelection && adminRoleSelection) {
            const roleKey = `student_service_${studentServiceSelection}_${adminRoleSelection}`;
            return {
              mainRole: 'admin_staff',
              userRole: roleKey,
              subRole: `student_service_${adminRoleSelection}`,
              service: studentServiceSelection
            };
          }
        }
        break;
    }

    if (mainRole === 'admin_staff') {
      if (adminSelection === 'other' && customAdminDept) {
        const normalizedDept = customAdminDept.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        if (adminRoleSelection === 'leader') return { mainRole: 'admin_staff', userRole: `${normalizedDept}_leader`, subRole: `${normalizedDept}_manager`, department: customAdminDept };
        if (adminRoleSelection === 'employee') return { mainRole: 'admin_staff', userRole: `${normalizedDept}_employee`, subRole: `${normalizedDept}_staff`, department: customAdminDept };
      }

      const isPredefined = ['hrm', 'finance', 'procurement_admin', 'resource_development', 'building_renovation', 'library_service', 'security', 'registrar', 'student_service'].includes(adminSelection);

      if (!isPredefined && adminSelection && adminSelection !== 'other') {
        if (adminRoleSelection === 'leader') return { mainRole: 'admin_staff', userRole: `${adminSelection}_leader`, subRole: `${adminSelection}_manager` };
        if (adminRoleSelection === 'employee') return { mainRole: 'admin_staff', userRole: `${adminSelection}_employee`, subRole: `${adminSelection}_staff` };
      }
    }

    return null;
  };

  const currentRoleData = getRoleData();

  const generateStrongPassword = () => {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const specials = '@$!%*?&';
    const all = uppercase + lowercase + numbers + specials;

    let pass = '';
    pass += uppercase[Math.floor(Math.random() * uppercase.length)];
    pass += lowercase[Math.floor(Math.random() * lowercase.length)];
    pass += numbers[Math.floor(Math.random() * numbers.length)];
    pass += specials[Math.floor(Math.random() * specials.length)];

    for (let i = 0; i < 8; i++) {
      pass += all[Math.floor(Math.random() * all.length)];
    }

    pass = pass.split('').sort(() => 0.5 - Math.random()).join('');

    setPassword(pass);
    setConfirmPassword(pass);
    setShowPassword(true);
    setShowConfirmPassword(true);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      setError('Password must be at least 8 characters long and contain an uppercase letter, a lowercase letter, a number, and a special character.');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (!currentRoleData) {
      setError('Please complete role selection');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName,
          middleName,
          lastName,
          username: username.toLowerCase().replace(/\s+/g, ''),
          email: email.trim(),
          password,
          displayName: `${firstName} ${middleName} ${lastName}`.replace(/\s+/g, ' ').trim(),
          ...currentRoleData,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        const errorMsg = result.error === 'Email is already registered.'
          ? 'Email is already registered to another user.'
          : (result.error || 'Failed to register user.');
        throw new Error(errorMsg);
      }

      if (mainRole === 'admin_staff' && adminSelection === 'other' && customAdminDept && db) {
        try {
          const settingsRef = doc(db, 'settings', 'admin_configurations');
          const settingsSnap = await getDoc(settingsRef);
          if (!settingsSnap.exists()) {
            await setDocWithAudit(settingsRef, { departments: [customAdminDept] });
          } else {
            await updateDocWithAudit(settingsRef, { departments: arrayUnion(customAdminDept) });
          }
        } catch (settingsErr) {
          console.error("Failed to save new admin department setting", settingsErr);
        }
      }

      if (mainRole === 'academic_staff' && academicSelection === 'department' && departmentSelection === 'other' && customDepartment && db) {
        try {
          const settingsRef = doc(db, 'settings', 'academic_configurations');
          const settingsSnap = await getDoc(settingsRef);
          if (!settingsSnap.exists()) {
            await setDocWithAudit(settingsRef, { departments: [customDepartment] });
          } else {
            await updateDocWithAudit(settingsRef, { departments: arrayUnion(customDepartment) });
          }
        } catch (settingsErr) {
          console.error("Failed to save new academic department setting", settingsErr);
        }
      }

      setSuccess(`User ${username} created successfully!`);

      setFirstName('');
      setMiddleName('');
      setLastName('');
      setUsername('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setMainRole('');
      setAcademicSelection('');
      setDepartmentSelection('');
      setCustomDepartment('');
      setDeptRoleSelection('');
      setProcurementSelection('');
      setStockStoreType('');
      setAdminSelection('');
      setStudentServiceSelection('');
      setAdminRoleSelection('');

      if (onSuccess) {
        setTimeout(() => onSuccess(), 1500);
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.message || 'Failed to register user.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-white">
      <div className="mb-8 border-b border-gray-100 pb-6">
        <h2 className="text-2xl font-semibold text-gray-900">{t('system_registration_header')}</h2>
        <p className="mt-1 text-sm text-gray-500">{t('registration_desc')}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="space-y-4">
          <h3 className="text-base font-medium text-gray-900 flex items-center gap-2">
            <FiUser className="text-gray-400" />
            {t('core_identity_header')}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('first_name_label')}</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => { const v = e.target.value.replace(/[^\p{L}\s./]/gu, ''); setFirstName(v); }}
                required
                placeholder="Abebe"
                className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm text-gray-900 transition-shadow"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('middle_name_label')}</label>
              <input
                type="text"
                value={middleName}
                onChange={(e) => { const v = e.target.value.replace(/[^\p{L}\s./]/gu, ''); setMiddleName(v); }}
                required
                placeholder="Kebede"
                className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm text-gray-900 transition-shadow"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('last_name_label')}</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => { const v = e.target.value.replace(/[^\p{L}\s./]/gu, ''); setLastName(v); }}
                required
                placeholder="Tessema"
                className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm text-gray-900 transition-shadow"
              />
            </div>
            <div className="md:col-span-3">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-gray-700">{t('email_address_label')}</label>
                <button
                  type="button"
                  onClick={() => {
                    if (firstName) {
                      let base = `${firstName.toLowerCase()}`;
                      if (middleName) base += `_${middleName.toLowerCase()}`;
                      base += Math.floor(10 + Math.random() * 90);
                      setUsername(base.replace(/\s+/g, ''));
                    } else {
                      setError("Please enter at least a first name to generate a username");
                    }
                  }}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 transition-colors"
                >
                  <FiRefreshCw className="w-3.5 h-3.5" />
                  Auto Generate
                </button>
              </div>
              <div className="relative">
                <FiUser className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                  required
                  placeholder="abebe_kebede"
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm text-gray-900 transition-shadow"
                />
              </div>
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Account Email (For Password Resets)</label>
              <div className="relative">
                <FiMail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="user@institution.edu"
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm text-gray-900 transition-shadow"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-gray-100">

          <div className="space-y-6">
            <div>
              <select
                value={mainRole}
                onChange={(e) => setMainRole(e.target.value)}
                required
                className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm text-gray-900 transition-shadow appearance-none"
              >
                <option value="" disabled>Select Domain...</option>
                <option value="academic_staff">{t('edu_academic_research')}</option>
                <option value="managing_director">{t('exec_directorate_office')}</option>

                <option value="procurement_management">{t('supply_chain_logistics')}</option>
                <option value="admin_staff">{t('inst_administration')}</option>
              </select>
            </div>

            {mainRole && (
              <div className="pl-4 border-l-2 border-gray-100 space-y-6">
                {mainRole === 'academic_staff' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('assignment_type')}</label>
                      <div className="flex gap-2">
                        {['academic_coordinator', 'department'].map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setAcademicSelection(type)}
                            className={`flex-1 py-2 rounded-lg text-sm transition-colors border ${academicSelection === type ? 'bg-blue-50 border-blue-200 text-blue-700 font-medium' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                          >
                            {type === 'academic_coordinator' ? t('coordinator_label') : t('dept_head_teacher_label')}
                          </button>
                        ))}
                      </div>
                    </div>

                    {academicSelection === 'department' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('department_label')}</label>
                          <select value={departmentSelection} onChange={(e) => setDepartmentSelection(e.target.value)} required className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm text-gray-900 transition-shadow">
                            <option value="">Select Faculty...</option>
                            {availableAcademicDepts.map((dept) => (
                              <option key={dept.id} value={dept.id}>{dept.label}</option>
                            ))}
                            <option value="other">Other (Add New)</option>
                          </select>
                        </div>

                        {departmentSelection === 'other' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('new_dept_name')}</label>
                            <input
                              type="text"
                              value={customDepartment}
                              onChange={(e) => setCustomDepartment(e.target.value)}
                              required
                              placeholder="e.g. Applied Physics"
                              className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm text-gray-900 transition-shadow"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {academicSelection === 'department' && departmentSelection && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Role inside department</label>
                        <div className="flex gap-2">
                          {[
                            { id: 'head', label: t('department_head_label') },
                            { id: 'teacher', label: t('faculty_teacher') }
                          ].map((role) => (
                            <button key={role.id} type="button" onClick={() => setDeptRoleSelection(role.id)} className={`flex-1 py-2 px-4 rounded-lg text-sm transition-colors border text-left ${deptRoleSelection === role.id ? 'bg-blue-50 border-blue-200 text-blue-700 font-medium' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                              {role.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {mainRole === 'procurement_management' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Procurement Role</label>
                      <div className="flex flex-wrap gap-2">
                        {['team_leader', 'stock_clerk', 'store_keeper'].map((role) => (
                          <button key={role} type="button" onClick={() => setProcurementSelection(role)} className={`flex-1 min-w-[120px] py-2 px-4 rounded-lg text-sm capitalize transition-colors border ${procurementSelection === role ? 'bg-blue-50 border-blue-200 text-blue-700 font-medium' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                            {role.replace('_', ' ')}
                          </button>
                        ))}
                      </div>
                    </div>
                    {(procurementSelection === 'stock_clerk' || procurementSelection === 'store_keeper') && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Store Type</label>
                        <div className="flex gap-2">
                          {['fixed_assets', 'consumable_items'].map((type) => (
                            <button key={type} type="button" onClick={() => setStockStoreType(type)} className={`flex-1 py-2 rounded-lg text-sm capitalize transition-colors border ${stockStoreType === type ? 'bg-blue-50 border-blue-200 text-blue-700 font-medium' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                              {type.replace('_', ' ')}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {mainRole === 'admin_staff' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('admin_unit')}</label>
                        <select
                          value={adminSelection}
                          onChange={(e) => setAdminSelection(e.target.value)}
                          className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm text-gray-900 transition-shadow appearance-none"
                        >
                          <option value="" disabled>Select Unit...</option>
                          {availableAdminDepts.map((dept) => (
                            <option key={dept.id} value={dept.id}>{dept.label}</option>
                          ))}
                          <option value="other">Other (Add New Team)</option>
                        </select>
                      </div>

                      {adminSelection === 'other' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('new_admin_team')}</label>
                          <input
                            type="text"
                            value={customAdminDept}
                            onChange={(e) => setCustomAdminDept(e.target.value)}
                            required
                            placeholder="e.g. Quality Assurance"
                            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm text-gray-900 transition-shadow"
                          />
                        </div>
                      )}
                    </div>

                    {adminSelection === 'student_service' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button type="button" onClick={() => { setStudentServiceSelection('overall'); setAdminRoleSelection('leader'); }} className={`py-2 px-4 rounded-lg text-sm transition-colors border ${studentServiceSelection === 'overall' ? 'bg-blue-50 border-blue-200 text-blue-700 font-medium' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                          {t('overall_leader')}
                        </button>
                        <select
                          value={studentServiceSelection === 'overall' ? '' : studentServiceSelection}
                          onChange={(e) => setStudentServiceSelection(e.target.value)}
                          className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm text-gray-900 transition-shadow appearance-none"
                        >
                          <option value="">{t('select_subunit_placeholder')}</option>
                          <option value="dormitory">{t('dormitory_label')}</option>
                          <option value="cafeteria">{t('cafeteria_label')}</option>
                          <option value="sport">{t('sport_label')}</option>
                        </select>
                      </div>
                    )}

                    {((adminSelection && adminSelection !== 'student_service') || (adminSelection === 'student_service' && studentServiceSelection && studentServiceSelection !== 'overall')) && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Authority Level</label>
                        <div className="flex gap-2">
                          {['leader', 'employee'].map((role) => (
                            <button key={role} type="button" onClick={() => setAdminRoleSelection(role)} className={`flex-1 py-2 px-4 rounded-lg text-sm transition-colors border ${adminRoleSelection === role ? 'bg-blue-50 border-blue-200 text-blue-700 font-medium' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                              {role === 'leader' ? t('leader_account') : t('employee_account')}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {currentRoleData && (
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Assigned System Role</p>
                  <p className="font-medium text-sm text-gray-900">
                    {currentRoleData.userRole.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                  </p>
                </div>
                <FiCheckCircle className="text-green-500" />
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-medium text-gray-900 flex items-center gap-2">
              <FiLock className="text-gray-400" />
              {t('access_security_header')}
            </h3>
            <button
              type="button"
              onClick={generateStrongPassword}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1.5 transition-colors"
            >
              <FiRefreshCw className="w-4 h-4" />
              Auto Generate
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('password')}</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm text-gray-900 transition-shadow pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('confirm_password_label')}</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm text-gray-900 transition-shadow pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  {showConfirmPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                </button>
              </div>
            </div>
            <div className="md:col-span-2">
              <p className="text-xs text-gray-500 flex items-start gap-1 mt-1">
                <FiShield className="shrink-0 mt-0.5 text-blue-500" />
                <span>Password must be at least 8 characters long and contain an uppercase letter, a lowercase letter, a number, and a special character.</span>
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-600 rounded-lg flex items-center gap-2 text-sm border border-red-100">
            <FiAlertCircle className="shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 bg-green-50 text-green-700 rounded-lg flex items-center gap-2 text-sm border border-green-100">
            <FiCheckCircle className="shrink-0" />
            {success}
          </div>
        )}

        <div className="pt-4">
          <button
            type="submit"
            disabled={loading}
            className="w-full md:w-auto px-8 py-3 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors disabled:bg-blue-400 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Registering...
              </>
            ) : (
              <>
                {t('complete_registration_btn')}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
