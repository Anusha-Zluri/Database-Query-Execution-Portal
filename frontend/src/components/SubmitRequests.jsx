import { useState, useEffect } from "react";
import { getDatabaseTypes, getInstances, getDatabases, submitRequest } from "../api/requests.api";
import { getPods } from "../api/pods.api";
import { getSubmissionForEdit } from "../api/submissions.api";

export default function SubmitRequests({ draftId, onDraftLoaded }) {
  const [submissionType, setSubmissionType] = useState("QUERY");
  const [formData, setFormData] = useState({
    db_instance: "",
    db_name: "",
    pod_id: "",
    content: "",
    comment: "",
  });
  const [scriptFile, setScriptFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  // Character limit for query text (PostgreSQL TEXT type limit is ~1GB, but practical limit)
  const QUERY_CHAR_LIMIT = 50000; // 50k characters is reasonable for queries
  
  // New state for dropdowns
  const [databaseTypes, setDatabaseTypes] = useState([]);
  const [instances, setInstances] = useState([]);
  const [databases, setDatabases] = useState([]);
  const [pods, setPods] = useState([]);
  const [selectedDbType, setSelectedDbType] = useState("");
  const [loadingDatabases, setLoadingDatabases] = useState(false);
  const [isDraft, setIsDraft] = useState(false);
  const [currentDraftId, setCurrentDraftId] = useState(null);
  const [clonedScriptInfo, setClonedScriptInfo] = useState(null);

  // Load draft data when draftId prop changes
  useEffect(() => {
    if (draftId) {
      const loadDraft = async () => {
        try {
          setLoading(true);
          const draft = await getSubmissionForEdit(draftId);
          
          // Get all database types first
          const typesData = await getDatabaseTypes();
          const types = typesData.types || [];
          
          // For each type, get instances and find the matching one
          let foundDbType = "";
          for (const type of types) {
            const instancesData = await getInstances(type);
            const instance = instancesData.instances?.find(i => i.name === draft.db_instance);
            if (instance) {
              foundDbType = type;
              setInstances(instancesData.instances || []);
              break;
            }
          }
          
          if (foundDbType) {
            setSelectedDbType(foundDbType);
          }
          
          // Load databases for the instance
          if (draft.db_instance) {
            const dbsData = await getDatabases(draft.db_instance);
            setDatabases(dbsData.databases || []);
          }
          
          // Set form data from draft
          setSubmissionType(draft.request_type);
          setFormData({
            db_instance: draft.db_instance,
            db_name: draft.db_name,
            pod_id: draft.pod_id,
            content: draft.query_text || "",
            comment: draft.comment || "",
          });
          
          // For scripts, store the file path info
          if (draft.request_type === 'SCRIPT' && draft.file_path) {
            setClonedScriptInfo({
              originalPath: draft.file_path,
              fileName: draft.file_path.split('/').pop()
            });
          }
          
          setIsDraft(true);
          setCurrentDraftId(draftId);
          
          // Notify parent that draft is loaded
          if (onDraftLoaded) {
            onDraftLoaded();
          }
        } catch (err) {
          console.error("Failed to load draft:", err);
          setError("Failed to load cloned submission");
        } finally {
          setLoading(false);
        }
      };
      loadDraft();
    }
  }, [draftId, onDraftLoaded]);

  // Fetch database types on mount
  useEffect(() => {
    const fetchTypes = async () => {
      try {
        const data = await getDatabaseTypes();
        setDatabaseTypes(data.types || []);
      } catch (err) {
        console.error("Failed to fetch database types:", err);
        setError("Failed to load database types. Please refresh the page.");
      }
    };
    fetchTypes();
  }, []);

  // Fetch pods on mount
  useEffect(() => {
    const fetchPods = async () => {
      try {
        const data = await getPods();
        setPods(data || []);
      } catch (err) {
        console.error("Failed to fetch pods:", err);
        setError("Failed to load PODs. Please refresh the page.");
      }
    };
    fetchPods();
  }, []);

  // Fetch instances when database type changes
  useEffect(() => {
    if (selectedDbType) {
      const fetchInstances = async () => {
        try {
          const data = await getInstances(selectedDbType);
          setInstances(data.instances || []);
        } catch (err) {
          console.error("Failed to fetch instances:", err);
          setError("Failed to load instances. Please try again.");
        }
      };
      fetchInstances();
    } else {
      setInstances([]);
      setFormData(prev => ({ ...prev, db_instance: "", db_name: "" }));
    }
  }, [selectedDbType]);

  // Fetch databases when instance changes
  useEffect(() => {
    if (formData.db_instance) {
      const fetchDatabases = async () => {
        setLoadingDatabases(true);
        try {
          const data = await getDatabases(formData.db_instance);
          setDatabases(data.databases || []);
        } catch (err) {
          console.error("Failed to fetch databases:", err);
          setError("Failed to fetch databases from instance");
        } finally {
          setLoadingDatabases(false);
        }
      };
      fetchDatabases();
    } else {
      setDatabases([]);
      setFormData(prev => ({ ...prev, db_name: "" }));
    }
  }, [formData.db_instance]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append("request_type", submissionType);
      formDataToSend.append("db_instance", formData.db_instance);
      formDataToSend.append("db_name", formData.db_name);
      formDataToSend.append("pod_id", formData.pod_id);
      formDataToSend.append("comment", formData.comment);

      if (submissionType === "QUERY") {
        if (!formData.content.trim()) {
          setError("Please enter a query");
          setLoading(false);
          return;
        }
        
        // Validate MongoDB JSON format if it's a MongoDB instance
        const selectedInstance = instances.find(inst => inst.name === formData.db_instance);
        if (selectedInstance && selectedInstance.engine === 'mongodb') {
          try {
            const parsed = JSON.parse(formData.content.trim());
            if (!parsed.collection || !parsed.operation) {
              setError("MongoDB query must include 'collection' and 'operation' fields");
              setLoading(false);
              return;
            }
          } catch (jsonError) {
            setError(`Invalid JSON format for MongoDB query: ${jsonError.message}`);
            setLoading(false);
            return;
          }
        }
        
        formDataToSend.append("content", formData.content);
      } else {
        // For scripts: either new file or cloned script
        if (!scriptFile && !clonedScriptInfo) {
          setError("Please upload a JavaScript (.js) file");
          setLoading(false);
          return;
        }
        if (scriptFile) {
          formDataToSend.append("script", scriptFile);
        }
        // If no new file but has clonedScriptInfo, the backend will use the existing script
      }

      // Validate comment
      if (!formData.comment.trim()) {
        setError("Please add a comment describing what this request does");
        setLoading(false);
        return;
      }

      const data = await submitRequest(formDataToSend);

      setSuccess(data.message || "Request submitted successfully!");
      // Reset form
      setFormData({
        db_instance: "",
        db_name: "",
        pod_id: "",
        content: "",
        comment: "",
      });
      setScriptFile(null);
      setSelectedDbType("");
      setDatabases([]);
      setInstances([]);
      setIsDraft(false);
      setCurrentDraftId(null);
      setClonedScriptInfo(null);
      // Clear file input
      const fileInput = document.getElementById("scriptUpload");
      if (fileInput) fileInput.value = "";
    } catch (err) {
      // Handle different error types
      const errorMessage = err.response?.data?.message || err.message || "Failed to submit request";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.name.endsWith(".js")) {
        setScriptFile(file);
        setError("");
      } else {
        setError("Please upload a .js file");
        setScriptFile(null);
        e.target.value = ""; // Clear the input
      }
    }
  };

  const handleCancel = () => {
    setFormData({
      db_instance: "",
      db_name: "",
      pod_id: "",
      content: "",
      comment: "",
    });
    setScriptFile(null);
    setError("");
    setSuccess("");
    setSelectedDbType("");
    setDatabases([]);
    setInstances([]);
    setIsDraft(false);
    setCurrentDraftId(null);
    setClonedScriptInfo(null);
    // Clear file input
    const fileInput = document.getElementById("scriptUpload");
    if (fileInput) fileInput.value = "";
  };

  return (
    <div className="flex gap-6">
      {/* Main Form */}
      <div className="flex-1">
        {isDraft && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
            <span className="font-semibold">📋 Editing cloned submission</span> - Make your changes and submit when ready
          </div>
        )}
        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          {/* Database Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Database Type <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={selectedDbType}
              onChange={(e) => {
                setSelectedDbType(e.target.value);
                setFormData({ ...formData, db_instance: "", db_name: "" });
                setDatabases([]);
              }}
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1a9d7c] focus:border-transparent"
            >
              <option value="">Select Type (PostgreSQL/MongoDB)</option>
              {databaseTypes.map((type) => (
                <option key={type} value={type}>
                  {type === "postgres" ? "PostgreSQL" : type === "mongodb" ? "MongoDB" : type}
                </option>
              ))}
            </select>
          </div>

          {/* Instance Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Instance Name <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={formData.db_instance}
              onChange={(e) => {
                setFormData({ ...formData, db_instance: e.target.value, db_name: "" });
                setDatabases([]);
              }}
              disabled={!selectedDbType}
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1a9d7c] focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
            >
              <option value="">Select Instance</option>
              {instances.map((instance) => (
                <option key={instance.name} value={instance.name}>
                  {instance.name} {instance.description && `- ${instance.description}`}
                </option>
              ))}
            </select>
          </div>

          {/* Database Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Database Name <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={formData.db_name}
              onChange={(e) => setFormData({ ...formData, db_name: e.target.value })}
              disabled={!formData.db_instance || loadingDatabases}
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1a9d7c] focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
            >
              <option value="">
                {loadingDatabases ? "Loading databases..." : "Select Database"}
              </option>
              {databases.map((db) => (
                <option key={db} value={db}>
                  {db}
                </option>
              ))}
            </select>
          </div>

          {/* Submission Type Radio */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Submission Type <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="submissionType"
                  value="QUERY"
                  checked={submissionType === "QUERY"}
                  onChange={(e) => setSubmissionType(e.target.value)}
                  className="w-4 h-4 text-[#1a9d7c] focus:ring-[#1a9d7c]"
                />
                <span className="text-sm text-slate-700">Query</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="submissionType"
                  value="SCRIPT"
                  checked={submissionType === "SCRIPT"}
                  onChange={(e) => setSubmissionType(e.target.value)}
                  className="w-4 h-4 text-[#1a9d7c] focus:ring-[#1a9d7c]"
                />
                <span className="text-sm text-slate-700">Script</span>
              </label>
            </div>
          </div>

          {/* Query Textarea (shown if Query selected) */}
          {submissionType === "QUERY" && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-700">
                  Query <span className="text-red-500">*</span>
                </label>
                <span className={`text-xs ${
                  formData.content.length > QUERY_CHAR_LIMIT 
                    ? 'text-red-600 font-bold' 
                    : formData.content.length > QUERY_CHAR_LIMIT * 0.95 
                    ? 'text-red-600 font-semibold' 
                    : formData.content.length > QUERY_CHAR_LIMIT * 0.8 
                    ? 'text-yellow-600 font-medium' 
                    : 'text-slate-500'
                }`}>
                  {formData.content.length.toLocaleString()} / {QUERY_CHAR_LIMIT.toLocaleString()} characters
                </span>
              </div>
              <textarea
                required
                value={formData.content}
                onChange={(e) => {
                  // Only update if within limit
                  if (e.target.value.length <= QUERY_CHAR_LIMIT) {
                    setFormData({ ...formData, content: e.target.value });
                  }
                }}
                onPaste={(e) => {
                  // Handle paste - truncate if needed
                  const pastedText = e.clipboardData.getData('text');
                  const currentText = formData.content;
                  const cursorPosition = e.target.selectionStart;
                  const textBeforeCursor = currentText.substring(0, cursorPosition);
                  const textAfterCursor = currentText.substring(e.target.selectionEnd);
                  const newText = textBeforeCursor + pastedText + textAfterCursor;
                  
                  if (newText.length > QUERY_CHAR_LIMIT) {
                    e.preventDefault();
                    const availableSpace = QUERY_CHAR_LIMIT - (textBeforeCursor.length + textAfterCursor.length);
                    if (availableSpace > 0) {
                      const truncatedPaste = pastedText.substring(0, availableSpace);
                      setFormData({ ...formData, content: textBeforeCursor + truncatedPaste + textAfterCursor });
                    }
                    setError(`Pasted content was truncated to fit the ${QUERY_CHAR_LIMIT.toLocaleString()} character limit.`);
                    setTimeout(() => setError(""), 3000);
                  }
                }}
                placeholder={
                  selectedDbType === 'mongodb' 
                    ? 'Enter MongoDB query as JSON:\n{ "collection": "movies", "operation": "find", "args": { "filter": { "year": 2024 } } }'
                    : 'Enter SQL query:\nSELECT * FROM users WHERE active = true;'
                }
                className={`w-full rounded-lg border px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:border-transparent font-mono text-sm resize-y min-h-[120px] max-h-[500px] ${
                  formData.content.length > QUERY_CHAR_LIMIT * 0.95
                    ? 'border-red-300 focus:ring-red-500'
                    : 'border-slate-300 focus:ring-[#1a9d7c]'
                }`}
                style={{
                  height: Math.min(Math.max(120, (formData.content.split('\n').length + 1) * 24), 500) + 'px'
                }}
              />
              {formData.content.length > QUERY_CHAR_LIMIT * 0.95 && (
                <p className="mt-1 text-xs text-red-600">
                  ⚠️ Character limit almost reached! {(QUERY_CHAR_LIMIT - formData.content.length).toLocaleString()} characters remaining.
                </p>
              )}
              {formData.content.length > QUERY_CHAR_LIMIT * 0.8 && formData.content.length <= QUERY_CHAR_LIMIT * 0.95 && (
                <p className="mt-1 text-xs text-yellow-600">
                  ⚠️ {(QUERY_CHAR_LIMIT - formData.content.length).toLocaleString()} characters remaining.
                </p>
              )}
            </div>
          )}

          {/* Upload Script (shown if Script selected) */}
          {submissionType === "SCRIPT" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Upload Script <span className="text-red-500">*</span>
              </label>
              
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-[#1a9d7c] transition-colors">
                <input
                  type="file"
                  accept=".js"
                  onChange={handleFileChange}
                  className="hidden"
                  id="scriptUpload"
                />
                <label htmlFor="scriptUpload" className="cursor-pointer">
                  <div className="flex flex-col items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-slate-400">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    <p className="text-sm text-slate-600">
                      {scriptFile ? scriptFile.name : "Click to upload or drag and drop .js file"}
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Comments */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Comments <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              value={formData.comment}
              onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
              placeholder="Describe what this query does..."
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1a9d7c] focus:border-transparent"
            />
          </div>

          {/* POD Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              POD Name <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={formData.pod_id}
              onChange={(e) => setFormData({ ...formData, pod_id: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1a9d7c] focus:border-transparent"
            >
              <option value="">Select POD</option>
              {pods.map((pod) => (
                <option key={pod.id} value={pod.id}>
                  {pod.name}
                </option>
              ))}
            </select>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-600">
              {success}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading || loadingDatabases}
              className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-[#1a9d7c] to-[#14b8a6] text-white font-medium hover:shadow-lg hover:shadow-[#1a9d7c]/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Submitting..." : "SUBMIT"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="px-6 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-all"
            >
              CANCEL
            </button>
          </div>
        </form>
      </div>

      {/* Documentation Sidebar (shown when Script is selected) */}
      {submissionType === "SCRIPT" && (
        <div className="w-80 bg-slate-900 text-slate-300 rounded-xl p-6 space-y-4 overflow-y-auto max-h-[calc(100vh-12rem)]">
          <div className="flex items-center gap-2 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
            <h3 className="text-lg font-semibold text-white">Documentation</h3>
          </div>

          <div className="space-y-4 text-sm">
            <p className="text-slate-400">
              Database connections are auto-injected. No hardcoded credentials needed!
            </p>

            <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
              <p className="text-white font-medium">Node.js Scripts (.js)</p>
            </div>

            <div>
              <p className="text-white font-medium mb-2">PostgreSQL Example:</p>
              <pre className="bg-slate-800 rounded-lg p-3 text-xs overflow-x-auto border border-slate-700 text-slate-300">
{`module.exports = async function ({ db, utils }) {
  await db.query(
    \`INSERT INTO events (event_name)
     VALUES ($1), ($2)\`,
    ['user_login', 'user_logout']
  );
  
  const result = await db.query(
    \`SELECT id, event_name, created_at
     FROM events
     ORDER BY id DESC
     LIMIT 5\`
  );
  
  return {
    rowCount: result.rowCount,
    rows: result.rows
  };
};`}
              </pre>
            </div>

            <div>
              <p className="text-white font-medium mb-2">MongoDB Example:</p>
              <pre className="bg-slate-800 rounded-lg p-3 text-xs overflow-x-auto border border-slate-700 text-slate-300">
{`module.exports = async function ({ db }) {
  const col = db.collection('movies');
  
  await col.insertOne({
    title: 'Bug Bash Fixed',
    year: 2026,
    status: 'Success'
  });
  
  const docs = await col
    .find({ title: 'Bug Bash Fixed' })
    .toArray();
  
  return {
    rowCount: docs.length,
    rows: docs
  };
};`}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
