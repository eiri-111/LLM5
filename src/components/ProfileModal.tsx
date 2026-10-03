import React, { useState } from 'react';
import { UserProfile, GenderType } from '../types';
import { User, Sparkles, AlertCircle } from 'lucide-react';

interface ProfileModalProps {
  initialProfile?: UserProfile | null;
  onSave: (profile: UserProfile) => void;
  isOpen: boolean;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ initialProfile, onSave, isOpen }) => {
  const [studentId, setStudentId] = useState(initialProfile?.student_id || '');
  const [age, setAge] = useState<string>(initialProfile?.age ? String(initialProfile.age) : '20');
  const [gender, setGender] = useState<GenderType>(initialProfile?.gender || 'prefer_not_to_say');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedId = studentId.trim();
    const numAge = parseInt(age, 10);

    if (!trimmedId) {
      setError('学籍番号を入力してください');
      return;
    }
    if (isNaN(numAge) || numAge < 15 || numAge > 100) {
      setError('正しい年齢（15〜100）を入力してください');
      return;
    }

    setError(null);
    onSave({
      student_id: trimmedId,
      age: numAge,
      gender
    });
  };

  return (
    <div className="modal-backdrop">
      <div className="profile-modal-card">
        <div className="profile-modal-header">
          <div className="profile-modal-icon-badge">
            <User size={24} className="text-indigo-600" />
          </div>
          <h2 className="profile-modal-title">診断前プロファイル登録</h2>
          <p className="profile-modal-subtitle">
            AI対話による性格分析および研究データ照合のため、以下の基本情報を入力してください。
          </p>
        </div>

        <form onSubmit={handleSubmit} className="profile-form">
          {error && (
            <div className="profile-form-error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="studentId" className="form-label">
              学籍番号 <span className="text-red-500">*</span>
            </label>
            <input
              id="studentId"
              type="text"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="例: AB12345 または 2024XXXX"
              className="form-input"
              required
              autoFocus
            />
            <span className="form-help">対話履歴および分析結果の保存・照合に使用されます</span>
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label htmlFor="age" className="form-label">
                年齢 <span className="text-red-500">*</span>
              </label>
              <input
                id="age"
                type="number"
                min="15"
                max="100"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="form-input"
                required
              />
            </div>

            <div className="form-group flex-1">
              <label htmlFor="gender" className="form-label">
                性別 <span className="text-red-500">*</span>
              </label>
              <select
                id="gender"
                value={gender}
                onChange={(e) => setGender(e.target.value as GenderType)}
                className="form-select"
              >
                <option value="male">男性</option>
                <option value="female">女性</option>
                <option value="other">その他</option>
                <option value="prefer_not_to_say">回答しない</option>
              </select>
            </div>
          </div>

          <div className="profile-form-footer">
            <button type="submit" className="start-btn">
              <Sparkles size={18} />
              <span>診断対話をはじめる</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
